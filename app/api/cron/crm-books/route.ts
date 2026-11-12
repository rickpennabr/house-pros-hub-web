import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendInvoiceEmail } from '@/lib/services/emailService';
import { getNextInvoiceNumber } from '@/lib/crm/invoice-number';
import { dueSoonThrough, nextRecurringDate, statusFromPayments, todayDateKey, type RecurringFrequency } from '@/lib/crm/invoice-books';

const REMINDER_GAP_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * GET /api/cron/crm-books
 * Creates due recurring invoices and emails a reminder for open past-due balances.
 * Authorize with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = todayDateKey();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '') ?? '';

  const created = await runRecurring(supabase, today, baseUrl);
  const dueSoon = await runDueSoon(supabase, today, baseUrl);
  const reminded = await runReminders(supabase, today, baseUrl);

  return NextResponse.json({ created, dueSoon, reminded });
}

async function runRecurring(
  supabase: ReturnType<typeof createServiceRoleClient>,
  today: string,
  baseUrl: string
) {
  let created = 0;
  const { data: due, error } = await supabase
    .from('pro_crm_recurring_invoices')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_date', today)
    .limit(100);
  if (error || !due) return created;

  for (const schedule of due) {
    let cursor = schedule.next_run_date;
    let steps = 0;
    while (cursor <= today && steps < 12) {
      if (schedule.end_date && cursor > schedule.end_date) break;
      const invoiceNumber = await getNextInvoiceNumber(supabase, schedule.owner_id);
      const { data: invoice, error: insertError } = await supabase
        .from('pro_crm_invoices')
        .insert({
          owner_id: schedule.owner_id,
          customer_id: schedule.customer_id,
          business_id: schedule.business_id,
          invoice_number: invoiceNumber,
          amount_cents: schedule.amount_cents,
          payment_applied_cents: 0,
          line_items: schedule.line_items,
          status: 'draft',
          invoice_date: cursor,
          due_date: cursor,
          payment_terms: schedule.payment_terms,
          note: schedule.note,
          recurring_invoice_id: schedule.id,
        })
        .select('id, invoice_number, amount_cents')
        .single();
      if (insertError || !invoice) break;

      created += 1;
      const sent = await emailInvoice(supabase, {
        ownerId: schedule.owner_id,
        invoiceId: invoice.id,
        customerId: schedule.customer_id,
        businessId: schedule.business_id,
        invoiceNumber: invoice.invoice_number,
        amountCents: invoice.amount_cents,
        baseUrl,
        message: 'This invoice was created from your recurring schedule.',
      });
      if (sent) {
        await supabase.from('pro_crm_invoices').update({ status: 'sent' }).eq('id', invoice.id);
      }
      await supabase.from('pro_crm_document_events').insert({
        owner_id: schedule.owner_id,
        invoice_id: invoice.id,
        actor_id: schedule.owner_id,
        action: 'recurred',
        payload: { schedule_id: schedule.id, sent },
      });

      cursor = nextRecurringDate(cursor, schedule.frequency as RecurringFrequency);
      steps += 1;
    }

    const stillActive = !schedule.end_date || cursor <= schedule.end_date;
    await supabase
      .from('pro_crm_recurring_invoices')
      .update({ next_run_date: cursor, is_active: stillActive && schedule.is_active })
      .eq('id', schedule.id);
  }

  return created;
}

async function runDueSoon(
  supabase: ReturnType<typeof createServiceRoleClient>,
  today: string,
  baseUrl: string
) {
  let reminded = 0;
  const { data: open, error } = await supabase
    .from('pro_crm_invoices')
    .select('id, owner_id, customer_id, business_id, invoice_number, amount_cents, payment_applied_cents, due_date, status, due_soon_reminded_at')
    .in('status', ['sent', 'partial'])
    .gte('due_date', today)
    .lte('due_date', dueSoonThrough(today))
    .is('due_soon_reminded_at', null)
    .limit(200);
  if (error || !open) return reminded;

  for (const invoice of open) {
    const balance = invoice.amount_cents - invoice.payment_applied_cents;
    if (balance <= 0 || !invoice.due_date) continue;
    const sent = await emailInvoice(supabase, {
      ownerId: invoice.owner_id,
      invoiceId: invoice.id,
      customerId: invoice.customer_id,
      businessId: invoice.business_id,
      invoiceNumber: invoice.invoice_number,
      amountCents: balance,
      baseUrl,
      message: `This invoice is due on ${invoice.due_date}.`,
    });
    if (!sent) continue;
    await supabase
      .from('pro_crm_invoices')
      .update({ due_soon_reminded_at: new Date().toISOString() })
      .eq('id', invoice.id);
    await supabase.from('pro_crm_document_events').insert({
      owner_id: invoice.owner_id,
      invoice_id: invoice.id,
      actor_id: null,
      action: 'reminded',
      payload: { kind: 'due_soon', due_date: invoice.due_date },
    });
    reminded += 1;
  }
  return reminded;
}

async function runReminders(
  supabase: ReturnType<typeof createServiceRoleClient>,
  today: string,
  baseUrl: string
) {
  let reminded = 0;
  const { data: open, error } = await supabase
    .from('pro_crm_invoices')
    .select('id, owner_id, customer_id, business_id, invoice_number, amount_cents, payment_applied_cents, due_date, status, last_reminded_at')
    .in('status', ['sent', 'partial', 'overdue'])
    .lt('due_date', today)
    .limit(200);
  if (error || !open) return reminded;

  const cutoff = Date.now() - REMINDER_GAP_MS;
  for (const invoice of open) {
    if (invoice.amount_cents - invoice.payment_applied_cents <= 0) continue;
    if (invoice.last_reminded_at && Date.parse(invoice.last_reminded_at) > cutoff) continue;
    const sent = await emailInvoice(supabase, {
      ownerId: invoice.owner_id,
      invoiceId: invoice.id,
      customerId: invoice.customer_id,
      businessId: invoice.business_id,
      invoiceNumber: invoice.invoice_number,
      amountCents: invoice.amount_cents - invoice.payment_applied_cents,
      baseUrl,
      message: 'This invoice is past due. You can review it from the link in this email.',
    });
    if (!sent) continue;
    const status = statusFromPayments({
      storedStatus: invoice.status,
      dueDate: invoice.due_date,
      totalCents: invoice.amount_cents,
      paidCents: invoice.payment_applied_cents,
      today,
    });
    await supabase
      .from('pro_crm_invoices')
      .update({ status, last_reminded_at: new Date().toISOString() })
      .eq('id', invoice.id);
    await supabase.from('pro_crm_document_events').insert({
      owner_id: invoice.owner_id,
      invoice_id: invoice.id,
      actor_id: null,
      action: 'reminded',
      payload: { status },
    });
    reminded += 1;
  }
  return reminded;
}

async function emailInvoice(
  supabase: ReturnType<typeof createServiceRoleClient>,
  input: {
    ownerId: string;
    invoiceId: string;
    customerId: string;
    businessId: string | null;
    invoiceNumber: string;
    amountCents: number;
    baseUrl: string;
    message: string;
  }
) {
  if (!input.baseUrl) return false;
  const { data: customer } = await supabase
    .from('pro_crm_customers')
    .select('email')
    .eq('id', input.customerId)
    .single();
  const toEmail = customer?.email;
  if (!toEmail) return false;

  let businessName = 'Us';
  if (input.businessId) {
    const { data: business } = await supabase
      .from('businesses')
      .select('business_name')
      .eq('id', input.businessId)
      .single();
    businessName = business?.business_name ?? 'Us';
  }

  const { data: tokenRow, error: tokenError } = await supabase
    .from('pro_invoice_view_tokens')
    .insert({
      invoice_id: input.invoiceId,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('token')
    .single();
  if (tokenError || !tokenRow) return false;

  const viewUrl = `${input.baseUrl}/en/invoices/view?token=${tokenRow.token}`;
  const emailResult = await sendInvoiceEmail(
    {
      businessName,
      invoiceNumber: input.invoiceNumber,
      amountCents: input.amountCents,
      viewUrl,
      message: input.message,
    },
    toEmail
  );
  return emailResult.success;
}

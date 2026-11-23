import { recordCustomerPlaceEvent } from '@/lib/places/timeline';
import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';
import { buildInvoiceReminder } from '@/lib/invoices/reminder';
import { generateInvoiceReminderEmail, invoiceReminderSubject } from '@/lib/utils/emailTemplates';
import { sendInvoiceReminderEmail } from '@/lib/services/emailService';

async function build(request: NextRequest, id: string, userId: string, message?: string | null) {
  return buildInvoiceReminder({
    supabase: await createClient(),
    service: createServiceRoleClient(),
    ownerId: userId,
    invoiceId: id,
    baseUrl: getPublicSiteUrlForEmail(request),
    locale: request.headers.get('x-next-intl-locale') || 'en',
    message,
  });
}

/**
 * GET /api/crm/invoices/[id]/reminder
 * Preview the payment reminder: who it goes to, the subject and the email HTML.
 * ?message= overrides the default note.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await params;
    const raw = new URL(request.url).searchParams.get('message');
    const built = await build(request, id, user.id, raw === null ? undefined : raw);
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });
    return NextResponse.json({
      to: built.to,
      subject: invoiceReminderSubject(built.email),
      html: generateInvoiceReminderEmail(built.email),
      defaultMessage: built.defaultMessage,
      daysOverdue: built.state.daysOverdue,
      dueKind: built.state.kind,
      balanceCents: built.state.balanceCents,
    });
  } catch (err) {
    console.error('GET /api/crm/invoices/[id]/reminder', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/invoices/[id]/reminder  { message?: string }
 * Email the customer a branded "your invoice is due" reminder with the pay link.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { message?: unknown };
    const message = typeof body.message === 'string' ? body.message.slice(0, 2000) : undefined;
    const built = await build(request, id, user.id, message);
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

    const sent = await sendInvoiceReminderEmail(built.email, built.to, built.replyTo);
    if (!sent.success) return NextResponse.json({ error: sent.error ?? 'Failed to send email' }, { status: 500 });

    const supabase = await createClient();
    // Track it on the invoice history (also drives the customer portal timeline).
    const { error: eventError } = await supabase.from('pro_crm_document_events').insert({
      owner_id: user.id,
      invoice_id: id,
      actor_id: user.id,
      action: 'reminded',
      payload: { kind: 'manual', to: built.to, days_overdue: built.state.daysOverdue },
    });
    if (eventError) console.error('invoice reminder event', eventError.message);
    const { error: stampError } = await supabase
      .from('pro_crm_invoices')
      .update({ last_reminded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', user.id);
    if (stampError) console.error('invoice reminder stamp', stampError.message);
    await recordCustomerPlaceEvent(built.customerId, {
      kind: 'invoice_reminder',
      title: built.state.daysOverdue > 0 ? 'Payment reminder · past due' : 'Payment reminder · due today',
      detail: built.invoiceNumber,
      amountCents: built.state.balanceCents,
      ownerId: user.id,
    }).catch(() => null);

    return NextResponse.json({ ok: true, sentTo: built.to });
  } catch (err) {
    console.error('POST /api/crm/invoices/[id]/reminder', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

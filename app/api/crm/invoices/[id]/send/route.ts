import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';
import { sendInvoiceEmail } from '@/lib/services/emailService';
import { recordInvoiceReceived } from '@/lib/places/timeline';
import { loadInvoiceEmailBranding } from '@/lib/invoices/reminder';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() || undefined : undefined;

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_crm_invoices')
      .select('id, customer_id, invoice_number, amount_cents, status, business_id, company_display, payment_applied_cents')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (error || !row) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (row.status === 'cancelled') {
      return NextResponse.json({ error: 'This invoice is cancelled' }, { status: 400 });
    }

    const customerId = row.customer_id;
    if (!customerId) return NextResponse.json({ error: 'Invoice has no customer' }, { status: 400 });

    const { data: customerRow } = await supabase
      .from('pro_crm_customers')
      .select('email')
      .eq('id', customerId)
      .single();

    const toEmail = customerRow?.email;
    if (!toEmail || typeof toEmail !== 'string') {
      return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 });
    }

    const branding = await loadInvoiceEmailBranding(supabase, user.id, row.business_id ?? null, row.company_display);

    // Same pattern as estimate send: token INSERT RLS + nested estimate/invoice checks can fail under WITH CHECK.
    const serviceSupabase = createServiceRoleClient();
    const { data: tokenRow, error: tokenErr } = await serviceSupabase
      .from('pro_invoice_view_tokens')
      .insert({ invoice_id: id, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
      .select('token')
      .single();

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: 'Failed to create view token' }, { status: 500 });
    }

    const baseUrl = getPublicSiteUrlForEmail(request);
    const locale = request.headers.get('x-next-intl-locale') || 'en';
    const viewUrl = `${baseUrl}/${locale}/invoices/view?token=${(tokenRow as { token: string }).token}`;

    const emailResult = await sendInvoiceEmail(
      {
        ...branding,
        invoiceNumber: row.invoice_number,
        amountCents: row.amount_cents,
        // Marked paid counts as paid even when no payment amount was recorded.
        balanceCents: row.status === 'paid' ? 0 : Math.max(0, row.amount_cents - (row.payment_applied_cents ?? 0)),
        viewUrl,
        message,
      },
      toEmail
    );

    if (!emailResult.success) {
      return NextResponse.json({ error: emailResult.error ?? 'Failed to send email' }, { status: 500 });
    }

    if (row.status === 'draft') {
      await supabase
        .from('pro_crm_invoices')
        .update({ status: 'sent' })
        .eq('id', id)
        .eq('owner_id', user.id);
    }

    const { error: eventError } = await supabase.from('pro_crm_document_events').insert({
      owner_id: user.id,
      invoice_id: id,
      actor_id: user.id,
      action: 'sent',
      payload: { to: toEmail },
    });
    if (eventError) console.error('invoice sent event', eventError.message);

    await recordInvoiceReceived({
      customerId,
      invoiceId: row.id,
      invoiceNumber: row.invoice_number,
      amountCents: row.amount_cents ?? 0,
      ownerId: user.id,
    });

    return NextResponse.json({ ok: true, sentTo: toEmail });
  } catch (err) {
    console.error('POST /api/crm/invoices/[id]/send', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

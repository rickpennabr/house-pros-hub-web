import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';
import { resolveInvoiceDueDate } from '@/lib/invoices/invoiceDueOnReceipt';
import { getOrCreateInvoicePayLink } from '@/lib/invoices/payLink';

/**
 * POST /api/crm/invoices/[id]/payment-link
 * Give the pro a customer link. Opening it shows the invoice and a card payment button.
 * A draft invoice is marked sent so the customer can pay.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

    const { data: invoice, error } = await supabase
      .from('pro_crm_invoices')
      .select('id, status, amount_cents, payment_applied_cents, invoice_number, invoice_date, due_date, payment_terms')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();
    if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.status === 'cancelled') return NextResponse.json({ error: 'This invoice is cancelled' }, { status: 400 });
    if (invoice.amount_cents - invoice.payment_applied_cents <= 0) {
      return NextResponse.json({ error: 'This invoice is already paid' }, { status: 400 });
    }

    if (invoice.status === 'draft') {
      const { error: statusError } = await supabase
        .from('pro_crm_invoices')
        .update({ status: 'sent' })
        .eq('id', id)
        .eq('owner_id', user.id);
      if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });
    }

    const baseUrl = getPublicSiteUrlForEmail(request);
    const locale = request.headers.get('x-next-intl-locale') || 'en';
    const link = await getOrCreateInvoicePayLink(createServiceRoleClient(), id, baseUrl, locale);
    if (!link) {
      return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 });
    }
    const { url, token } = link;
    // The chat attaches this invoice as a card; it needs the token and the numbers, not just the link.
    return NextResponse.json({
      url,
      token,
      invoiceId: id,
      invoiceNumber: invoice.invoice_number,
      balanceCents: invoice.amount_cents - invoice.payment_applied_cents,
      dueDate: resolveInvoiceDueDate(invoice.invoice_date, invoice.due_date, invoice.payment_terms),
    });
  } catch (err) {
    console.error('POST /api/crm/invoices/[id]/payment-link', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

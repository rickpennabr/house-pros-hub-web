import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';

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
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await hasRole(user.id, 'contractor'))) {
      return NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

    const { data: invoice, error } = await supabase
      .from('pro_crm_invoices')
      .select('id, status, amount_cents, payment_applied_cents')
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

    const service = createServiceRoleClient();
    const { data: tokenRow, error: tokenError } = await service
      .from('pro_invoice_view_tokens')
      .insert({
        invoice_id: id,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('token')
      .single();
    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 });
    }

    const baseUrl = getPublicSiteUrlForEmail(request);
    const locale = request.headers.get('x-next-intl-locale') || 'en';
    const url = `${baseUrl}/${locale}/invoices/view?token=${tokenRow.token}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error('POST /api/crm/invoices/[id]/payment-link', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

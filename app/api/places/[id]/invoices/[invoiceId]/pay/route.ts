import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createInvoiceCheckoutSession } from '@/lib/billing/invoice-checkout';
import { requirePortalUser } from '@/lib/places/session';

/**
 * POST /api/places/[id]/invoices/[invoiceId]/pay
 * Start a card payment for an invoice on the customer's place.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const { error: authError, user } = await requirePortalUser();
    if (authError || !user) return authError;

    const { id: placeId, invoiceId } = await params;
    if (!placeId || !invoiceId) return NextResponse.json({ error: 'Invoice required' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data: invoice } = await supabase
      .from('pro_crm_invoices')
      .select('id, customer_id, status')
      .eq('id', invoiceId)
      .maybeSingle();
    if (!invoice || invoice.status === 'draft') return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('id')
      .eq('id', invoice.customer_id)
      .eq('portal_user_id', user.id)
      .eq('place_id', placeId)
      .maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const origin = request.nextUrl.origin;
    const locale = request.headers.get('x-next-intl-locale') || 'en';
    const back = `${origin}/${locale}/myplaces/${placeId}`;
    const session = await createInvoiceCheckoutSession(supabase, invoiceId, {
      successUrl: `${back}?paid=1`,
      cancelUrl: back,
    });
    if ('error' in session) return NextResponse.json({ error: session.error }, { status: 400 });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('POST /api/places/[id]/invoices/[invoiceId]/pay', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

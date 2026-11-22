import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createInvoiceCheckoutSession } from '@/lib/billing/invoice-checkout';
import { safeChatReturnTo } from '@/lib/chat/crm-doc-share';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * POST /api/invoices/public/pay
 * Start a card payment for the open balance on a public invoice link.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = await checkRateLimit(request, 'publicLinkWrite');
    if (limited) return limited;
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('pro_invoice_view_tokens')
      .select('invoice_id, expires_at')
      .eq('token', token)
      .single();
    if (tokenErr || !tokenRow) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 404 });
    }

    const origin = request.nextUrl.origin;
    const locale = request.headers.get('x-next-intl-locale') || 'en';
    // Paying from a chat card: Stripe sends the customer back to that chat.
    const chatReturn = safeChatReturnTo(typeof body.returnTo === 'string' ? body.returnTo : null);
    const view = `${origin}/${locale}/invoices/view?token=${encodeURIComponent(token)}`;
    const session = await createInvoiceCheckoutSession(supabase, tokenRow.invoice_id, {
      successUrl: chatReturn ? `${origin}${chatReturn}` : `${view}&paid=1`,
      cancelUrl: chatReturn ? `${origin}${chatReturn}` : view,
    });
    if ('error' in session) return NextResponse.json({ error: session.error }, { status: 400 });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('POST /api/invoices/public/pay', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { acceptSentEstimate } from '@/lib/crm/accept-estimate';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';

/**
 * POST /api/estimates/public/approve
 * Approves an estimate using a valid public token. No auth required.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('pro_estimate_view_tokens')
      .select('estimate_id, expires_at')
      .eq('token', token)
      .single();

    if (tokenErr || !tokenRow) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 404 });
    }

    const locale = request.headers.get('x-next-intl-locale') || 'en';
    const result = await acceptSentEstimate(supabase, tokenRow.estimate_id, {
      baseUrl: getPublicSiteUrlForEmail(request),
      locale,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({
      ok: true,
      status: result.status,
      depositInvoiceId: result.depositInvoiceId,
      depositError: result.depositError,
    });
  } catch (err) {
    console.error('POST /api/estimates/public/approve', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

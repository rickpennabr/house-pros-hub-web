import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { acceptSentEstimate } from '@/lib/crm/accept-estimate';
import { requirePortalUser } from '@/lib/places/session';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';

/**
 * POST /api/places/[id]/estimates/[estimateId]/approve
 * The signed-in customer approves a sent estimate on this place.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; estimateId: string }> }
) {
  try {
    const { error: authError, user } = await requirePortalUser();
    if (authError || !user) return authError;

    const { id: placeId, estimateId } = await params;
    if (!placeId || !estimateId) return NextResponse.json({ error: 'Estimate required' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data: estimate } = await supabase
      .from('pro_crm_estimates')
      .select('id, customer_id')
      .eq('id', estimateId)
      .maybeSingle();
    if (!estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('id')
      .eq('id', estimate.customer_id)
      .eq('portal_user_id', user.id)
      .eq('place_id', placeId)
      .maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });

    const locale = request.headers.get('x-next-intl-locale') || 'en';
    const result = await acceptSentEstimate(supabase, estimateId, {
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
    console.error('POST /api/places/[id]/estimates/[estimateId]/approve', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

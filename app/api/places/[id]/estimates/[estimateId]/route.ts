import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requirePortalUser } from '@/lib/places/session';
import { docBelongsToPlace } from '@/lib/places/contact-places';
import { loadEstimateBusinessBrand } from '@/lib/crm/estimate-business-brand';

/**
 * GET /api/places/[id]/estimates/[estimateId]
 * Full agreement document for the signed-in customer on this place.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; estimateId: string }> }
) {
  try {
    const { error: authError, user } = await requirePortalUser();
    if (authError || !user) return authError;

    const { id: placeId, estimateId } = await params;
    if (!placeId || !estimateId) {
      return NextResponse.json({ error: 'Estimate required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: estimate } = await supabase
      .from('pro_crm_estimates')
      .select(
        'id, customer_id, place_id, owner_id, display_id, amount_cents, deposit_cents, line_items, status, due_date, note, job_area, agreement_kind, maintenance_frequency, signed_at, signer_name'
      )
      .eq('id', estimateId)
      .neq('status', 'draft')
      .maybeSingle();
    if (!estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('id, first_name, last_name, display_name, company_name, email')
      .eq('id', estimate.customer_id)
      .eq('portal_user_id', user.id)
      .maybeSingle();
    if (!customer || !(await docBelongsToPlace(supabase, { userId: user.id, placeId, doc: estimate }))) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const business = await loadEstimateBusinessBrand(supabase, estimate.owner_id);

    return NextResponse.json({
      estimateId: estimate.id,
      estimateNumber: estimate.display_id,
      amountCents: estimate.amount_cents,
      depositCents: estimate.deposit_cents ?? 0,
      lineItems: estimate.line_items,
      status: estimate.status,
      validUntilDate: estimate.due_date,
      note: estimate.note,
      jobArea: estimate.job_area ?? null,
      agreementKind: estimate.agreement_kind ?? 'project',
      maintenanceFrequency: estimate.maintenance_frequency ?? null,
      signedAt: estimate.signed_at ?? null,
      signerName: estimate.signer_name ?? null,
      customer: {
        first_name: customer.first_name,
        last_name: customer.last_name,
        display_name: customer.display_name,
        company_name: customer.company_name,
        email: customer.email,
      },
      business,
    });
  } catch (err) {
    console.error('GET /api/places/[id]/estimates/[estimateId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { docPlaceLabel } from '@/lib/places/contact-places';
import { loadEstimateBusinessBrand } from '@/lib/crm/estimate-business-brand';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * GET /api/estimates/public?token=uuid
 * Returns estimate data for public review. No auth. Token must be valid and not expired.
 */
export async function GET(request: NextRequest) {
  try {
    const limited = await checkRateLimit(request, 'publicLinkRead');
    if (limited) return limited;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
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

    const estimateId = tokenRow.estimate_id;
    const { data: row, error } = await supabase
      .from('pro_crm_estimates')
      .select('*')
      .eq('id', estimateId)
      .single();
    if (error || !row) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('first_name, last_name, display_name, company_name, email')
      .eq('id', row.customer_id)
      .single();

    const [business, place] = await Promise.all([
      loadEstimateBusinessBrand(supabase, row.owner_id),
      // The customer's house it is on now, for the chat card (the saved label can go stale).
      docPlaceLabel(supabase, { kind: 'estimate', id: row.id, customerId: row.customer_id }),
    ]);

    return NextResponse.json({
      estimateId: row.id,
      place,
      estimateNumber: row.display_id,
      amountCents: row.amount_cents,
      depositCents: row.deposit_cents ?? 0,
      lineItems: row.line_items,
      status: row.status,
      validUntilDate: row.due_date,
      note: row.note,
      jobArea: row.job_area ?? null,
      agreementKind: row.agreement_kind ?? 'project',
      maintenanceFrequency: row.maintenance_frequency ?? null,
      signedAt: row.signed_at ?? null,
      signerName: row.signer_name ?? null,
      customer: customer
        ? {
            first_name: customer.first_name,
            last_name: customer.last_name,
            display_name: customer.display_name,
            company_name: customer.company_name,
            email: customer.email,
          }
        : null,
      business,
    });
  } catch (err) {
    console.error('GET /api/estimates/public', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

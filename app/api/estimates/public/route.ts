import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/estimates/public?token=uuid
 * Returns estimate data for public review. No auth. Token must be valid and not expired.
 */
export async function GET(request: NextRequest) {
  try {
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

    let business: { business_name: string; business_logo: string | null; email: string | null; phone: string | null } = {
      business_name: 'My Business',
      business_logo: null,
      email: null,
      phone: null,
    };
    const { data: biz } = await supabase
      .from('businesses')
      .select('business_name, business_logo, email, phone')
      .eq('owner_id', row.owner_id)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (biz) {
      business = {
        business_name: biz.business_name,
        business_logo: biz.business_logo,
        email: biz.email,
        phone: biz.phone,
      };
    }

    return NextResponse.json({
      estimateId: row.id,
      estimateNumber: row.display_id,
      amountCents: row.amount_cents,
      lineItems: row.line_items,
      status: row.status,
      validUntilDate: row.due_date,
      note: row.note,
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

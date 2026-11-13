import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

/**
 * GET /api/crm/estimates/[id]/customer-preview
 * Same payload shape as GET /api/estimates/public for contractor preview before sending email.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const isContractor = await hasRole(user.id, 'contractor');
    if (!isContractor) {
      return NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Estimate ID required' }, { status: 400 });

    const { data: row, error } = await supabase
      .from('pro_crm_estimates')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
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
      .maybeSingle();
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
      depositCents: row.deposit_cents ?? 0,
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
    console.error('GET /api/crm/estimates/[id]/customer-preview', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

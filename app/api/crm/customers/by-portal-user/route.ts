import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';

/**
 * GET /api/crm/customers/by-portal-user?userId=
 * Resolve the CRM contact linked to a hub login (chat customer).
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const userId = request.nextUrl.searchParams.get('userId')?.trim();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const { data: row, error } = await supabase
      .from('pro_crm_customers')
      .select('id, first_name, last_name, display_name, company_name, email')
      .eq('owner_id', user.id)
      .eq('portal_user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ customer: null });

    const name =
      row.display_name?.trim() ||
      [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
      row.company_name?.trim() ||
      row.email ||
      'Customer';

    return NextResponse.json({
      customer: { id: row.id, name, email: row.email },
    });
  } catch (err) {
    console.error('GET /api/crm/customers/by-portal-user', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

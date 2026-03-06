import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return { error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

const VALID_SORT = ['created_at', 'updated_at', 'last_name', 'first_name', 'city', 'state', 'phone', 'email'] as const;

/**
 * GET /api/crm/customers
 * List CRM customers for the authenticated contractor. Paginated, sortable, searchable.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));
    const sortBy = (searchParams.get('sortBy') || 'created_at') as (typeof VALID_SORT)[number];
    const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc';
    const search = (searchParams.get('search') || '').trim();

    const supabase = await createClient();
    const orderColumn = VALID_SORT.includes(sortBy) ? sortBy : 'created_at';

    let query = supabase
      .from('pro_crm_customers')
      .select('*', { count: 'exact' })
      .eq('owner_id', user.id)
      .order(orderColumn, { ascending: sortDir === 'asc' });

    if (search) {
      const safe = search.replace(/[%,"\\]/g, '').trim();
      if (safe) {
        const term = `%${safe}%`;
        query = query.or(
          `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},city.ilike.${term},state.ilike.${term},phone.ilike.${term}`
        );
      }
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: customers, error: fetchError, count } = await query.range(from, to);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message || 'Failed to fetch customers' }, { status: 500 });
    }

    return NextResponse.json({
      customers: customers ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    console.error('GET /api/crm/customers', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/customers
 * Create a CRM customer. Contractor only; owner_id set to current user.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const body = await request.json();
    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const firstName = trim(body.firstName);
    const lastName = trim(body.lastName);
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_crm_customers')
      .insert({
        owner_id: user.id,
        first_name: firstName,
        last_name: lastName,
        email: trim(body.email) || null,
        phone: trim(body.phone) || null,
        street_address: trim(body.streetAddress) || null,
        apartment: trim(body.apartment) || null,
        city: trim(body.city) || null,
        state: trim(body.state) || null,
        zip_code: trim(body.zipCode) || null,
        note: trim(body.note) || null,
      })
      .select('id, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create customer' }, { status: 500 });
    }
    return NextResponse.json({ id: row.id, created_at: row.created_at }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/customers', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

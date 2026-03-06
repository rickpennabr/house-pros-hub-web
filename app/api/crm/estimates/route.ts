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

const VALID_SORT = ['created_at', 'updated_at', 'status', 'due_date', 'amount_cents'] as const;

export async function GET(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));
    const sortBy = (searchParams.get('sortBy') || 'created_at') as (typeof VALID_SORT)[number];
    const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc';
    const statusFilter = searchParams.get('status') || '';

    const supabase = await createClient();
    const orderColumn = VALID_SORT.includes(sortBy) ? sortBy : 'created_at';

    let query = supabase
      .from('pro_crm_estimates')
      .select('*', { count: 'exact' })
      .eq('owner_id', user.id)
      .order(orderColumn, { ascending: sortDir === 'asc' });

    if (statusFilter && ['draft', 'sent', 'accepted', 'declined'].includes(statusFilter)) {
      query = query.eq('status', statusFilter as 'draft' | 'sent' | 'accepted' | 'declined');
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: estimates, error: fetchError, count } = await query.range(from, to);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message || 'Failed to fetch estimates' }, { status: 500 });
    }

    const list = estimates ?? [];
    const customerIds = [...new Set(list.map((e) => e.customer_id))];
    const customerMap = new Map<string, { first_name: string; last_name: string }>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('pro_crm_customers')
        .select('id, first_name, last_name')
        .in('id', customerIds);
      customers?.forEach((c) => customerMap.set(c.id, { first_name: c.first_name, last_name: c.last_name }));
    }

    const customersList = list.map((e) => {
      const c = customerMap.get(e.customer_id);
      return {
        ...e,
        customerFirstName: c?.first_name ?? null,
        customerLastName: c?.last_name ?? null,
      };
    });

    return NextResponse.json({
      estimates: customersList,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    console.error('GET /api/crm/estimates', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const body = await request.json();
    const customerId = body.customerId ?? body.customer_id;
    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('id')
      .eq('id', customerId)
      .eq('owner_id', user.id)
      .single();
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const amountCents = typeof body.amountCents === 'number' ? body.amountCents : parseInt(String(body.amountCents || 0), 10) || 0;
    const status = ['draft', 'sent', 'accepted', 'declined'].includes(body.status) ? body.status : 'draft';
    const dueDate = body.dueDate || body.due_date || null;
    const note = typeof body.note === 'string' ? body.note.trim() || null : null;
    const lineItems = body.lineItems ?? body.line_items ?? null;

    const { data: row, error } = await supabase
      .from('pro_crm_estimates')
      .insert({
        owner_id: user.id,
        customer_id: customerId,
        amount_cents: amountCents,
        line_items: lineItems,
        status,
        due_date: dueDate,
        note,
      })
      .select('id, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create estimate' }, { status: 500 });
    }
    return NextResponse.json({ id: row.id, created_at: row.created_at }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/estimates', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

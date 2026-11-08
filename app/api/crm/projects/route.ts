import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { contactCanBeInvoiced } from '@/lib/crm/contact-role';

async function requireContractor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) return { error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }), user: null };
  return { error: null, user };
}

const VALID_SORT = ['created_at', 'updated_at', 'name', 'status', 'start_date', 'end_date'] as const;

async function validateEstimateLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  customerId: string,
  estimateId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!estimateId) return { ok: true };
  const { data: estimate } = await supabase
    .from('pro_crm_estimates')
    .select('id, customer_id')
    .eq('id', estimateId)
    .eq('owner_id', ownerId)
    .single();
  if (!estimate) return { ok: false, message: 'Estimate not found' };
  if (estimate.customer_id !== customerId) {
    return { ok: false, message: 'Estimate must belong to the same customer' };
  }
  return { ok: true };
}

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
    const search = (searchParams.get('search') || '').replace(/[%_,.()]/g, ' ').trim();

    const supabase = await createClient();
    const orderColumn = VALID_SORT.includes(sortBy) ? sortBy : 'created_at';

    let query = supabase
      .from('pro_crm_projects')
      .select('*', { count: 'exact' })
      .eq('owner_id', user.id)
      .order(orderColumn, { ascending: sortDir === 'asc' });

    if (statusFilter && ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'].includes(statusFilter)) {
      query = query.eq('status', statusFilter as 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled');
    }

    if (search) {
      const { data: matchingCustomers } = await supabase
        .from('pro_crm_customers')
        .select('id')
        .eq('owner_id', user.id)
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,display_name.ilike.%${search}%,company_name.ilike.%${search}%`);
      const ids = (matchingCustomers ?? []).map((customer) => customer.id);
      const parts = [`name.ilike.%${search}%`];
      if (ids.length > 0) parts.push(`customer_id.in.(${ids.join(',')})`);
      query = query.or(parts.join(','));
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: projects, error: fetchError, count } = await query.range(from, to);

    if (fetchError) return NextResponse.json({ error: fetchError.message || 'Failed to fetch projects' }, { status: 500 });

    const list = projects ?? [];
    const customerIds = [...new Set(list.map((p) => p.customer_id))];
    const customerMap = new Map<string, { first_name: string; last_name: string }>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase.from('pro_crm_customers').select('id, first_name, last_name').in('id', customerIds);
      customers?.forEach((c) => customerMap.set(c.id, { first_name: c.first_name, last_name: c.last_name }));
    }

    const withCustomer = list.map((p) => {
      const c = customerMap.get(p.customer_id);
      return { ...p, customerFirstName: c?.first_name ?? null, customerLastName: c?.last_name ?? null };
    });

    return NextResponse.json({ projects: withCustomer, total: count ?? 0, page, pageSize });
  } catch (err) {
    console.error('GET /api/crm/projects', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const body = await request.json();
    const customerId = body.customerId ?? body.customer_id;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!customerId || !name) return NextResponse.json({ error: 'Customer and project name are required' }, { status: 400 });

    const supabase = await createClient();
    const { data: customer } = await supabase.from('pro_crm_customers').select('id').eq('id', customerId).eq('owner_id', user.id).single();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    if (!(await contactCanBeInvoiced(supabase, customerId))) {
      return NextResponse.json({ error: 'This contact cannot be invoiced. Add a role that can be invoiced.' }, { status: 400 });
    }

    const status = ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'].includes(body.status) ? body.status : 'planned';
    const estimateId = body.estimateId ?? body.estimate_id ?? null;
    const estimateValidation = await validateEstimateLink(supabase, user.id, customerId, estimateId);
    if (!estimateValidation.ok) {
      return NextResponse.json({ error: estimateValidation.message }, { status: 400 });
    }

    const startDate = body.startDate ?? body.start_date ?? null;
    const endDate = body.endDate ?? body.end_date ?? null;
    const note = typeof body.note === 'string' ? body.note.trim() || null : null;

    const { data: row, error } = await supabase
      .from('pro_crm_projects')
      .insert({
        owner_id: user.id,
        customer_id: customerId,
        estimate_id: estimateId,
        name,
        status,
        start_date: startDate,
        end_date: endDate,
        note,
      })
      .select('id, display_id, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message || 'Failed to create project' }, { status: 500 });
    return NextResponse.json({ id: row.id, display_id: row.display_id, created_at: row.created_at }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/projects', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

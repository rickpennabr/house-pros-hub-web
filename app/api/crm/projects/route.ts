import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { contactCanBeInvoiced } from '@/lib/crm/contact-role';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { safeTimeZone } from '@/lib/crm/estimate-chart';
import { buildProjectChart, type ProjectChart } from '@/lib/crm/list-charts';

async function requireContractor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) return { error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }), user: null };
  return { error: null, user };
}

const VALID_SORT = ['created_at', 'updated_at', 'name', 'status', 'start_date', 'end_date'] as const;

/** Sum job expenses for the projects on this page. Pages past the default row cap so the total is complete. */
async function sumExpenseCentsByProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  projectIds: string[]
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (projectIds.length === 0) return totals;
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('pro_crm_expenses')
      .select('project_id, amount_cents')
      .eq('owner_id', ownerId)
      .in('project_id', projectIds)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message || 'Failed to load project costs');
    for (const row of data ?? []) {
      if (!row.project_id) continue;
      totals.set(row.project_id, (totals.get(row.project_id) ?? 0) + (row.amount_cents ?? 0));
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return totals;
}

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

    let projectSearch: string | null = null;
    if (search) {
      const { data: matchingCustomers } = await supabase
        .from('pro_crm_customers')
        .select('id')
        .eq('owner_id', user.id)
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,display_name.ilike.%${search}%,company_name.ilike.%${search}%`);
      const ids = (matchingCustomers ?? []).map((customer) => customer.id);
      const parts = [`name.ilike.%${search}%`];
      if (ids.length > 0) parts.push(`customer_id.in.(${ids.join(',')})`);
      projectSearch = parts.join(',');
      query = query.or(projectSearch);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: projects, error: fetchError, count } = await query.range(from, to);

    if (fetchError) return NextResponse.json({ error: fetchError.message || 'Failed to fetch projects' }, { status: 500 });

    const list = projects ?? [];
    const customerIds = [...new Set(list.map((p) => p.customer_id))];
    const estimateIds = [...new Set(list.map((p) => p.estimate_id).filter((id): id is string => Boolean(id)))];
    const projectIds = list.map((p) => p.id);

    const [customersResult, estimatesResult, expenseTotals] = await Promise.all([
      customerIds.length > 0
        ? supabase.from('pro_crm_customers').select('id, first_name, last_name, display_name, company_name, street_address, apartment, city, state, zip_code, billing_address_street_1, billing_address_street_2, billing_address_city, billing_address_state, billing_address_zip_code').in('id', customerIds)
        : Promise.resolve({ data: [] as {
            id: string;
            first_name: string;
            last_name: string;
            display_name: string | null;
            company_name: string | null;
            street_address: string | null;
            apartment: string | null;
            city: string | null;
            state: string | null;
            zip_code: string | null;
            billing_address_street_1: string | null;
            billing_address_street_2: string | null;
            billing_address_city: string | null;
            billing_address_state: string | null;
            billing_address_zip_code: string | null;
          }[], error: null }),
      estimateIds.length > 0
        ? supabase.from('pro_crm_estimates').select('id, amount_cents').eq('owner_id', user.id).in('id', estimateIds)
        : Promise.resolve({ data: [] as { id: string; amount_cents: number }[], error: null }),
      sumExpenseCentsByProject(supabase, user.id, projectIds),
    ]);
    if (customersResult.error) {
      return NextResponse.json({ error: customersResult.error.message || 'Failed to load customers' }, { status: 500 });
    }
    if (estimatesResult.error) {
      return NextResponse.json({ error: estimatesResult.error.message || 'Failed to load contract amounts' }, { status: 500 });
    }

    const customerMap = new Map<string, {
      first_name: string;
      last_name: string;
      display_name: string | null;
      company_name: string | null;
      street_address: string | null;
      apartment: string | null;
      city: string | null;
      state: string | null;
      zip_code: string | null;
      billing_address_street_1: string | null;
      billing_address_street_2: string | null;
      billing_address_city: string | null;
      billing_address_state: string | null;
      billing_address_zip_code: string | null;
    }>();
    customersResult.data?.forEach((c) => customerMap.set(c.id, c));
    const contractByEstimate = new Map<string, number>();
    estimatesResult.data?.forEach((estimate) => contractByEstimate.set(estimate.id, estimate.amount_cents ?? 0));

    const withCustomer = list.map((p) => {
      const c = customerMap.get(p.customer_id);
      const contractAmountCents = p.estimate_id ? contractByEstimate.get(p.estimate_id) ?? null : null;
      const home = [c?.street_address, c?.apartment, c?.city, c?.state, c?.zip_code]
        .map((part) => part?.trim() ?? '')
        .filter(Boolean)
        .join(', ');
      const billing = [
        c?.billing_address_street_1,
        c?.billing_address_street_2,
        c?.billing_address_city,
        c?.billing_address_state,
        c?.billing_address_zip_code,
      ]
        .map((part) => part?.trim() ?? '')
        .filter(Boolean)
        .join(', ');
      return {
        ...p,
        customerFirstName: c?.first_name ?? null,
        customerLastName: c?.last_name ?? null,
        customerDisplayName: c ? contactDisplayName(c) : null,
        customerAddress: home || billing,
        contract_amount_cents: contractAmountCents,
        project_cost_cents: expenseTotals.get(p.id) ?? 0,
      };
    });

    let chart: ProjectChart | null = null;
    if (searchParams.get('chart') === '1') {
      const timeZone = safeTimeZone(searchParams.get('timeZone'));
      let chartQuery = supabase
        .from('pro_crm_projects')
        .select('id, status, estimate_id, start_date, created_at')
        .eq('owner_id', user.id)
        .limit(2000);
      if (projectSearch) chartQuery = chartQuery.or(projectSearch);
      const { data: chartRows, error: chartError } = await chartQuery;
      if (chartError) return NextResponse.json({ error: chartError.message || 'Failed to load project chart' }, { status: 500 });
      const rows = chartRows ?? [];
      const chartEstimateIds = [...new Set(rows.map((row) => row.estimate_id).filter((id): id is string => Boolean(id)))];
      const [chartEstimates, chartCosts] = await Promise.all([
        chartEstimateIds.length
          ? supabase.from('pro_crm_estimates').select('id, amount_cents').eq('owner_id', user.id).in('id', chartEstimateIds)
          : Promise.resolve({ data: [] as { id: string; amount_cents: number }[], error: null }),
        sumExpenseCentsByProject(supabase, user.id, rows.map((row) => row.id)),
      ]);
      if (chartEstimates.error) {
        return NextResponse.json({ error: chartEstimates.error.message || 'Failed to load contract amounts' }, { status: 500 });
      }
      const contractByEstimate = new Map<string, number>();
      chartEstimates.data?.forEach((estimate) => contractByEstimate.set(estimate.id, estimate.amount_cents ?? 0));
      chart = buildProjectChart(
        rows.map((row) => ({
          status: row.status,
          contractCents: row.estimate_id ? contractByEstimate.get(row.estimate_id) ?? null : null,
          costCents: chartCosts.get(row.id) ?? 0,
          startedOn: row.start_date || row.created_at,
        })),
        { timeZone }
      );
    }

    return NextResponse.json({ projects: withCustomer, total: count ?? 0, page, pageSize, chart });
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

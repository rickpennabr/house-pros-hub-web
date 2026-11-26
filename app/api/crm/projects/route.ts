import { recordCustomerPlaceEvent } from '@/lib/places/timeline';
import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { contactHasPlace } from '@/lib/places/contact-places';
import { contactCanBeInvoiced } from '@/lib/crm/contact-role';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { safeTimeZone } from '@/lib/crm/estimate-chart';
import { buildProjectChart, type ProjectChart } from '@/lib/crm/list-charts';
import type { CrmDb } from '@/lib/crm/crm-scope';
import { jobFinancialsFrom, loadOwnerJobData } from '@/lib/crm/job-financials-db';
import type { JobFinancials } from '@/lib/crm/job-financials';

const VALID_SORT = ['created_at', 'updated_at', 'name', 'status', 'start_date', 'end_date'] as const;

/** Sum job expenses for the projects on this page. Pages past the default row cap so the total is complete. */
/**
 * True cost of each project, the same number its financial report shows: linked expenses, logged
 * hours, mileage and equipment days, plus the overhead %.
 */
async function projectFinancialsById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  projectIds: string[]
): Promise<Map<string, JobFinancials>> {
  const result = new Map<string, JobFinancials>();
  if (projectIds.length === 0) return result;
  const data = await loadOwnerJobData(supabase as unknown as CrmDb, ownerId, { today: new Date().toISOString().slice(0, 10) });
  for (const id of projectIds) {
    const key = `project:${id}` as const;
    if (data.jobs.has(key)) result.set(id, jobFinancialsFrom(data, key));
  }
  return result;
}

async function sumExpenseCentsByProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  projectIds: string[]
): Promise<Map<string, number>> {
  const financials = await projectFinancialsById(supabase, ownerId, projectIds);
  return new Map([...financials].map(([id, fin]) => [id, fin.totalCostCents]));
}

/** Project manager on each project: the team member with the Project manager role. */
async function projectManagersById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectIds: string[]
): Promise<Map<string, string>> {
  const managers = new Map<string, string>();
  if (projectIds.length === 0) return managers;
  const { data: members } = await supabase
    .from('pro_crm_project_members')
    .select('project_id, contact_id, role_id')
    .in('project_id', projectIds);
  if (!members?.length) return managers;
  const roleIds = [...new Set(members.map((row) => row.role_id))];
  const { data: roles } = await supabase.from('pro_crm_roles').select('id, slug').in('id', roleIds);
  const pmRoles = new Set((roles ?? []).filter((role) => role.slug === 'project_manager').map((role) => role.id));
  const pmRows = members.filter((row) => pmRoles.has(row.role_id));
  if (pmRows.length === 0) return managers;
  const { data: contacts } = await supabase
    .from('pro_crm_customers')
    .select('id, first_name, last_name, display_name, company_name')
    .in('id', [...new Set(pmRows.map((row) => row.contact_id))]);
  const names = new Map((contacts ?? []).map((contact) => [contact.id, contactDisplayName(contact)]));
  for (const row of pmRows) {
    const name = names.get(row.contact_id);
    if (!name) continue;
    managers.set(row.project_id, managers.has(row.project_id) ? `${managers.get(row.project_id)}, ${name}` : name);
  }
  return managers;
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

    const [customersResult, estimatesResult, financials, managers] = await Promise.all([
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
      projectFinancialsById(supabase, user.id, projectIds),
      projectManagersById(supabase, projectIds),
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

    // The property each project is at (a customer can have several).
    const placeIds = [...new Set(list.map((p) => (p as { place_id?: string | null }).place_id).filter((id): id is string => Boolean(id)))];
    const placeMap = new Map<string, { name: string | null; street: string | null; city: string | null }>();
    if (placeIds.length) {
      const { data: places } = await createServiceRoleClient().from('customer_places').select('id, name, street, city').in('id', placeIds);
      (places ?? []).forEach((place: { id: string; name: string | null; street: string | null; city: string | null }) => placeMap.set(place.id, place));
    }

    const withCustomer = list.map((p) => {
      const place = (p as { place_id?: string | null }).place_id ? placeMap.get((p as { place_id?: string | null }).place_id as string) : undefined;
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
        propertyName: place?.name ?? null,
        propertyAddress: place ? [place.street, place.city].filter(Boolean).join(', ') : null,
        contract_amount_cents: contractAmountCents,
        project_cost_cents: financials.get(p.id)?.totalCostCents ?? 0,
        invoiced_cents: financials.get(p.id)?.revenue.invoicedCents ?? 0,
        collected_cents: financials.get(p.id)?.revenue.collectedCents ?? 0,
        balance_cents: financials.get(p.id)?.revenue.outstandingCents ?? 0,
        labor_hours: financials.get(p.id)?.laborHours ?? 0,
        project_manager: managers.get(p.id) ?? null,
        city: c?.city?.trim() || c?.billing_address_city?.trim() || null,
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

    // One of the contact's properties; empty is their default (sent only when set, so older
    // databases without the column keep working).
    const rawPlace = body.placeId ?? body.place_id ?? null;
    const placeId = typeof rawPlace === 'string' && rawPlace ? rawPlace : null;
    if (placeId && !(await contactHasPlace(createServiceRoleClient(), customerId, placeId))) {
      return NextResponse.json({ error: "That property is not one of this customer's properties." }, { status: 400 });
    }

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
        ...(placeId ? { place_id: placeId } : {}),
      })
      .select('id, display_id, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message || 'Failed to create project' }, { status: 500 });
    if (estimateId) await copyEstimateMaterials(user.id, estimateId, row.id).catch((err) => console.error('copy estimate materials', err));
    if (customerId) {
      await recordCustomerPlaceEvent(customerId, {
        placeId: placeId || undefined,
        kind: 'project_shared',
        title: `Project added · ${name}`,
        detail: startDate ? `Starts ${startDate}` : null,
        projectId: row.id,
        ownerId: user.id,
      }).catch(() => null);
    }
    return NextResponse.json({ id: row.id, display_id: row.display_id, created_at: row.created_at }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/projects', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** The estimate's materials list (from ProQuote) becomes the project's planned materials. */
async function copyEstimateMaterials(ownerId: string, estimateId: string, projectId: string) {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('pro_crm_estimate_materials' as never)
    .select('id, catalog_item_id, product_id, name, brand, options, area, unit, qty, sort_order')
    .eq('estimate_id', estimateId)
    .eq('owner_id', ownerId)
    .order('sort_order', { ascending: true });
  // Before migration 178 there is no list: nothing to copy.
  if (error || !data) return;
  const list = data as unknown as {
    id: string; catalog_item_id: string | null; product_id: string | null; name: string; brand: string | null;
    options: string | null; area: string | null; unit: string; qty: number | string; sort_order: number;
  }[];
  if (!list.length) return;
  const rows = list.map((m) => ({
    owner_id: ownerId,
    project_id: projectId,
    name: (m.brand ? m.name + " (" + m.brand + ")" : m.name).slice(0, 200),
    unit: m.unit,
    planned_qty: Number(m.qty) || 0,
    estimated_qty: Number(m.qty) || 0,
    note: [m.options, m.area ? "For " + m.area : null].filter(Boolean).join(" · ").slice(0, 500) || null,
    sort_order: m.sort_order,
    created_by: ownerId,
    catalog_item_id: m.catalog_item_id,
    product_id: m.product_id,
    estimate_material_id: m.id,
  }));
  const { error: insertError } = await db.from('pro_crm_project_materials' as never).insert(rows as never);
  if (insertError) throw new Error(insertError.message);
}

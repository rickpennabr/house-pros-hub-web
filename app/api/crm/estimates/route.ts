import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { crmEstimateCreateSchema, depositWithinEstimate, normalizeEstimateAmountCents } from '@/lib/schemas/crmEstimate';
import {
  DISCOUNT_MIGRATION_ERROR,
  discountColumns,
  discountedTotalCents,
  isMissingDiscountColumn,
} from '@/lib/crm/document-discount';
import { contactCanBeInvoiced } from '@/lib/crm/contact-role';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { summarizeEstimateStatuses } from '@/lib/crm/estimate-books';
import { buildEstimateChart, safeTimeZone, type EstimateChart } from '@/lib/crm/estimate-chart';
import { pickDocPlaceId } from '@/lib/places/contact-places';
import { rememberLineDescriptions } from '@/lib/crm/line-descriptions';
import type { CrmDb } from '@/lib/crm/crm-scope';

const VALID_SORT = ['created_at', 'updated_at', 'status', 'due_date', 'amount_cents'] as const;

function getDefaultEstimateValidityDate(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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
    const search = searchParams.get('search')?.trim() || '';
    const statusFilter = searchParams.get('status') || '';
    const customerIdFilter = searchParams.get('customerId')?.trim() || '';
    const includeChart = searchParams.get('chart') === '1';
    const timeZone = safeTimeZone(searchParams.get('timeZone'));

    const supabase = await createClient();
    const orderColumn = VALID_SORT.includes(sortBy) ? sortBy : 'created_at';

    const { data: statusRows, error: statusError } = await supabase
      .from('pro_crm_estimates')
      .select('status, amount_cents')
      .eq('owner_id', user.id)
      .limit(2000);
    if (statusError) return NextResponse.json({ error: statusError.message || 'Failed to fetch estimates' }, { status: 500 });
    const statusSummary = summarizeEstimateStatuses(
      (statusRows ?? []).map((row) => ({ status: row.status, amountCents: row.amount_cents }))
    );

    const chartFor = async (customerIds: string[] | null): Promise<EstimateChart | null> => {
      if (!includeChart) return null;
      let chartQuery = supabase
        .from('pro_crm_estimates')
        .select('status, amount_cents, created_at')
        .eq('owner_id', user.id)
        .limit(2000);
      if (customerIds) chartQuery = chartQuery.in('customer_id', customerIds);
      const { data: chartRows, error: chartError } = await chartQuery;
      if (chartError) throw new Error(chartError.message || 'Failed to fetch estimate chart');
      return buildEstimateChart(
        (chartRows ?? []).map((row) => ({
          status: row.status,
          amountCents: row.amount_cents,
          createdAt: row.created_at,
        })),
        { timeZone }
      );
    };

    let query = supabase
      .from('pro_crm_estimates')
      .select('*', { count: 'exact' })
      .eq('owner_id', user.id)
      .order(orderColumn, { ascending: sortDir === 'asc' });

    if (statusFilter && ['draft', 'sent', 'accepted', 'declined'].includes(statusFilter)) {
      query = query.eq('status', statusFilter as 'draft' | 'sent' | 'accepted' | 'declined');
    }
    if (customerIdFilter) {
      query = query.eq('customer_id', customerIdFilter);
    }

    let matchingCustomerIds: string[] | null = null;
    if (search) {
      const { data: matchingCustomers } = await supabase
        .from('pro_crm_customers')
        .select('id')
        .eq('owner_id', user.id)
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,display_name.ilike.%${search}%,company_name.ilike.%${search}%`);
      matchingCustomerIds = (matchingCustomers ?? []).map((customer) => customer.id);
      if (matchingCustomerIds.length === 0) {
        return NextResponse.json({
          estimates: [],
          total: 0,
          page,
          pageSize,
          statusSummary,
          chart: includeChart ? buildEstimateChart([], { timeZone }) : null,
        });
      }
      query = query.in('customer_id', matchingCustomerIds);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: estimates, error: fetchError, count } = await query.range(from, to);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message || 'Failed to fetch estimates' }, { status: 500 });
    }

    const list = estimates ?? [];
    const customerIds = [...new Set(list.map((e) => e.customer_id))];
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
      phone: string | null;
      billing_address_street_1: string | null;
      billing_address_street_2: string | null;
      billing_address_city: string | null;
      billing_address_state: string | null;
      billing_address_zip_code: string | null;
    }>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('pro_crm_customers')
        .select('id, first_name, last_name, display_name, company_name, street_address, apartment, city, state, zip_code, phone, billing_address_street_1, billing_address_street_2, billing_address_city, billing_address_state, billing_address_zip_code')
        .in('id', customerIds);
      customers?.forEach((c) => customerMap.set(c.id, c));
    }

    const customersList = list.map((e) => {
      const c = customerMap.get(e.customer_id);
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
      const address = home || billing;
      return {
        ...e,
        customerFirstName: c?.first_name ?? null,
        customerLastName: c?.last_name ?? null,
        customerDisplayName: c ? contactDisplayName(c) : null,
        customerPhone: c?.phone ?? null,
        customerAddress: address,
      };
    });

    const chart = await chartFor(matchingCustomerIds);

    return NextResponse.json({
      estimates: customersList,
      total: count ?? 0,
      page,
      pageSize,
      statusSummary,
      chart,
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

    const rawBody = await request.json();
    const parsed = crmEstimateCreateSchema.safeParse({
      customerId: rawBody.customerId ?? rawBody.customer_id,
      lineItems: rawBody.lineItems ?? rawBody.line_items ?? null,
      status: rawBody.status,
      dueDate: rawBody.dueDate ?? rawBody.due_date ?? null,
      validityDate: rawBody.validityDate ?? rawBody.validity_date ?? rawBody.valid_until ?? null,
      note: rawBody.note ?? null,
      depositCents: rawBody.depositCents ?? rawBody.deposit_cents,
      discount: rawBody.discount ?? null,
      jobArea: rawBody.jobArea ?? rawBody.job_area ?? null,
      agreementKind: rawBody.agreementKind ?? rawBody.agreement_kind,
      maintenanceFrequency: rawBody.maintenanceFrequency ?? rawBody.maintenance_frequency ?? null,
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid estimate payload';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const body = parsed.data;
    const customerId = body.customerId;
    if (!customerId) {
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
    if (!(await contactCanBeInvoiced(supabase, customerId))) {
      return NextResponse.json({ error: 'This contact cannot be invoiced. Add a role that can be invoiced.' }, { status: 400 });
    }

    const docPlace = await pickDocPlaceId(customerId, rawBody.placeId ?? rawBody.place_id);
    if (!docPlace.ok) return NextResponse.json({ error: docPlace.error }, { status: 400 });

    const lineItems = body.lineItems ?? null;
    const subtotalCents = normalizeEstimateAmountCents(lineItems);
    const discount = body.discount ?? null;
    const amountCents = discountedTotalCents(subtotalCents, discount);
    const depositCents = body.depositCents ?? 0;
    const depositError = depositWithinEstimate(depositCents, amountCents);
    if (depositError) return NextResponse.json({ error: depositError }, { status: 400 });
    // Every estimate starts as a draft. It becomes sent when emailed, and accepted or
    // declined after that, the same moves PUT allows. Starting it accepted would skip the customer.
    if (body.status && body.status !== 'draft') {
      return NextResponse.json({ error: 'A new estimate starts as a draft. Send it to move it on.' }, { status: 400 });
    }
    const status = 'draft';
    const dueDate = body.validityDate ?? body.dueDate ?? getDefaultEstimateValidityDate();
    const note = body.note?.trim() || null;
    const jobArea = body.jobArea?.trim() || null;
    const agreementKind = body.agreementKind ?? 'project';
    const maintenanceFrequency = agreementKind === 'maintenance' ? body.maintenanceFrequency ?? null : null;

    const { data: row, error } = await supabase
      .from('pro_crm_estimates')
      .insert({
        owner_id: user.id,
        customer_id: customerId,
        place_id: docPlace.placeId,
        amount_cents: amountCents,
        deposit_cents: depositCents,
        line_items: lineItems,
        status,
        due_date: dueDate,
        note,
        job_area: jobArea,
        agreement_kind: agreementKind,
        maintenance_frequency: maintenanceFrequency,
        // Only with a discount, so estimates still save before 159_document_discounts is applied.
        ...(discount ? discountColumns(subtotalCents, discount) : {}),
      })
      .select('id, display_id, created_at')
      .single();

    if (!error) await rememberLineDescriptions(supabase as unknown as CrmDb, user.id, lineItems).catch(() => undefined);
    if (error) {
      const message = isMissingDiscountColumn(error) ? DISCOUNT_MIGRATION_ERROR : error.message || 'Failed to create estimate';
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ id: row.id, display_id: row.display_id, created_at: row.created_at }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/estimates', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

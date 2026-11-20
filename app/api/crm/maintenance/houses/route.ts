import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { safeTimeZone, todayKeyInZone } from '@/lib/crm/estimate-chart';
import {
  buildMaintenanceChart,
  MAINTENANCE_HOUSE_STATUSES,
  type MaintenanceChart,
  type MaintenanceHouseStatus,
} from '@/lib/crm/list-charts';
import {
  agreementColumns,
  CONTACT_SELECT,
  houseAgreementSchema,
  houseContactName,
  houseLocation,
  housePlaceIds,
  houseStatus,
  loadPlaces,
  PLAN_SELECT,
  visitBelongsToHouse,
  type ContactRow,
  type PlanRow,
} from '@/lib/crm/maintenance-houses';
import { pickDocPlaceId } from '@/lib/places/contact-places';

const VALID_SORT = ['name', 'next_visit', 'last_visit', 'visits', 'status'] as const;
type SortKey = (typeof VALID_SORT)[number];
const STATUS_ORDER: Record<MaintenanceHouseStatus, number> = { overdue: 0, due_soon: 1, scheduled: 2, ended: 3 };
const ROW_CAP = 1000;

export interface MaintenanceHouseRow {
  id: string;
  customerId: string;
  customerName: string;
  placeName: string | null;
  address: string;
  city: string | null;
  phone: string | null;
  status: MaintenanceHouseStatus;
  planName: string;
  frequency: string;
  planCents: number | null;
  nextVisitDate: string | null;
  /** Agreement end date; visits stop after it. */
  endDate: string | null;
  lastVisitAt: string | null;
  visitCount: number;
  laborSeconds: number;
  openVisitId: string | null;
}

/**
 * GET /api/crm/maintenance/houses
 * One row per maintenance agreement (house). Search, status, sort, paging, and chart=1
 * work like the other CRM lists.
 */
export async function GET(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { supabase, ownerId } = scope;

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(params.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(params.get('pageSize') || '25', 10)));
    const sortParam = params.get('sortBy') as SortKey | null;
    const sortBy: SortKey = sortParam && VALID_SORT.includes(sortParam) ? sortParam : 'next_visit';
    const sortDir = params.get('sortDir') === 'desc' ? 'desc' : 'asc';
    const statusFilter = (MAINTENANCE_HOUSE_STATUSES as readonly string[]).includes(params.get('status') || '')
      ? (params.get('status') as MaintenanceHouseStatus)
      : null;
    const search = (params.get('search') || '').trim().toLowerCase();
    const timeZone = safeTimeZone(params.get('timeZone'));
    const today = todayKeyInZone(timeZone);

    const [plansResult, visitsResult] = await Promise.all([
      supabase
        .from('pro_crm_maintenance_plans')
        .select(PLAN_SELECT)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(ROW_CAP),
      supabase
        .from('pro_crm_maintenance_visits')
        .select('id, customer_id, maintenance_plan_id, status, started_at, labor_seconds, duration_seconds')
        .eq('owner_id', ownerId)
        .neq('status', 'cancelled')
        .order('started_at', { ascending: false })
        .limit(ROW_CAP * 5),
    ]);
    if (plansResult.error) return NextResponse.json({ error: plansResult.error.message }, { status: 500 });
    if (visitsResult.error) return NextResponse.json({ error: visitsResult.error.message }, { status: 500 });

    const plans = (plansResult.data ?? []) as PlanRow[];
    const visits = (visitsResult.data ?? []) as Array<{
      id: string;
      customer_id: string;
      maintenance_plan_id: string | null;
      status: string;
      started_at: string;
      labor_seconds: number | null;
      duration_seconds: number | null;
    }>;

    const plansPerContact = new Map<string, number>();
    plans.forEach((plan) => plansPerContact.set(plan.customer_id, (plansPerContact.get(plan.customer_id) ?? 0) + 1));

    const customerIds = [...new Set(plans.map((plan) => plan.customer_id))];
    const { data: contacts, error: contactsError } = customerIds.length
      ? await supabase.from('pro_crm_customers').select(CONTACT_SELECT).eq('owner_id', ownerId).in('id', customerIds)
      : { data: [], error: null };
    if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 500 });
    const contactRows = (contacts ?? []) as ContactRow[];
    const contactById = new Map(contactRows.map((contact) => [contact.id, contact]));
    const places = await loadPlaces(housePlaceIds(plans, contactRows));

    const visitsByPlan = new Map<string, typeof visits>();
    for (const plan of plans) {
      const count = plansPerContact.get(plan.customer_id) ?? 0;
      visitsByPlan.set(plan.id, visits.filter((visit) => visitBelongsToHouse(visit, plan, count)));
    }

    let rows: MaintenanceHouseRow[] = plans.map((plan) => {
      const contact = contactById.get(plan.customer_id);
      const location = houseLocation(plan, contact, places);
      const houseVisits = visitsByPlan.get(plan.id) ?? [];
      return {
        id: plan.id,
        customerId: plan.customer_id,
        customerName: houseContactName(contact),
        placeName: location.placeName,
        address: location.address,
        city: location.city,
        phone: contact?.phone ?? null,
        status: houseStatus(plan, today),
        planName: plan.name,
        frequency: plan.frequency,
        planCents: plan.amount_cents,
        nextVisitDate: plan.next_visit_date,
        endDate: plan.end_date,
        lastVisitAt: houseVisits[0]?.started_at ?? plan.last_visit_date ?? null,
        visitCount: houseVisits.length,
        laborSeconds: houseVisits.reduce((sum, v) => sum + (v.labor_seconds ?? v.duration_seconds ?? 0), 0),
        openVisitId: houseVisits.find((v) => v.status === 'in_progress' || v.status === 'on_break')?.id ?? null,
      };
    });

    if (search) {
      rows = rows.filter((row) =>
        [row.customerName, row.placeName ?? '', row.address, row.planName, row.phone ?? ''].some((text) =>
          text.toLowerCase().includes(search)
        )
      );
    }

    // The chart covers the search but not the status filter, so its slices can switch the filter.
    let chart: MaintenanceChart | null = null;
    if (params.get('chart') === '1') {
      chart = buildMaintenanceChart(
        rows.map((row) => ({
          status: row.status,
          planCents: row.planCents ?? 0,
          visitStarts: (visitsByPlan.get(row.id) ?? []).map((v) => v.started_at),
          laborSeconds: row.laborSeconds,
        })),
        { timeZone }
      );
    }

    if (statusFilter) rows = rows.filter((row) => row.status === statusFilter);

    const direction = sortDir === 'asc' ? 1 : -1;
    const compareNullable = (a: string | null, b: string | null) => {
      if (a === b) return 0;
      if (!a) return 1; // missing values always last
      if (!b) return -1;
      return a < b ? -direction : direction;
    };
    rows.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.customerName.localeCompare(b.customerName) * direction;
        case 'last_visit':
          return compareNullable(a.lastVisitAt, b.lastVisitAt);
        case 'visits':
          return (a.visitCount - b.visitCount) * direction;
        case 'status':
          return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * direction;
        default:
          return compareNullable(a.nextVisitDate, b.nextVisitDate) || a.customerName.localeCompare(b.customerName);
      }
    });

    const total = rows.length;
    const from = (page - 1) * pageSize;
    return NextResponse.json({ houses: rows.slice(from, from + pageSize), total, page, pageSize, chart });
  } catch (error) {
    console.error('GET /api/crm/maintenance/houses', error);
    return NextResponse.json({ error: 'Failed to load maintenance houses' }, { status: 500 });
  }
}

const createSchema = houseAgreementSchema.extend({ customerId: z.string().uuid() });

/**
 * POST /api/crm/maintenance/houses
 * Add a house: a contact, which of their houses, and the maintenance agreement for it.
 * Only the business owner sets up agreements; crew can add plants and record visits.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    if (scope.isCrew) {
      return NextResponse.json({ error: 'Only the business owner can add maintenance houses.' }, { status: 403 });
    }

    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid house' }, { status: 400 });
    }
    const input = parsed.data;

    const { data: contact } = await scope.supabase
      .from('pro_crm_customers')
      .select('id')
      .eq('id', input.customerId)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const place = await pickDocPlaceId(input.customerId, input.placeId ?? null);
    if (!place.ok) return NextResponse.json({ error: place.error }, { status: 400 });

    // One active agreement per house keeps visits and plants in one place.
    let duplicate = scope.supabase
      .from('pro_crm_maintenance_plans')
      .select('id')
      .eq('owner_id', scope.ownerId)
      .eq('customer_id', input.customerId)
      .eq('is_active', true);
    duplicate = place.placeId ? duplicate.eq('place_id', place.placeId) : duplicate.is('place_id', null);
    const { data: existing } = await duplicate.limit(1).maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: 'This house already has an active maintenance agreement.', houseId: existing.id },
        { status: 409 }
      );
    }

    const { data: plan, error: insertError } = await scope.supabase
      .from('pro_crm_maintenance_plans')
      .insert({
        owner_id: scope.ownerId,
        customer_id: input.customerId,
        place_id: place.placeId,
        is_active: true,
        ...agreementColumns(input),
      })
      .select('id')
      .single();
    if (insertError || !plan) {
      return NextResponse.json({ error: insertError?.message ?? 'Could not add the house' }, { status: 500 });
    }
    return NextResponse.json({ id: plan.id }, { status: 201 });
  } catch (error) {
    console.error('POST /api/crm/maintenance/houses', error);
    return NextResponse.json({ error: 'Failed to add the house' }, { status: 500 });
  }
}

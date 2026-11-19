import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { todayKeyInZone, safeTimeZone } from '@/lib/crm/estimate-chart';
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

type Params = { params: Promise<{ id: string }> };

async function loadPlan(scope: NonNullable<Awaited<ReturnType<typeof requireCrmScope>>['scope']>, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const { data } = await scope.supabase
    .from('pro_crm_maintenance_plans')
    .select(PLAN_SELECT)
    .eq('id', id)
    .eq('owner_id', scope.ownerId)
    .maybeSingle();
  return (data as PlanRow | null) ?? null;
}

/**
 * GET /api/crm/maintenance/houses/[id]
 * The house: contact, address, agreement, and the visits recorded there.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await params;
    const plan = await loadPlan(scope, id);
    if (!plan) return NextResponse.json({ error: 'House not found' }, { status: 404 });

    const [{ data: contact }, { data: visitRows }, { count: plansForContact }] = await Promise.all([
      scope.supabase.from('pro_crm_customers').select(CONTACT_SELECT).eq('id', plan.customer_id).maybeSingle(),
      scope.supabase
        .from('pro_crm_maintenance_visits')
        .select('id, customer_id, maintenance_plan_id, status, started_at, ended_at, duration_seconds, labor_seconds, worker_count')
        .eq('owner_id', scope.ownerId)
        .eq('customer_id', plan.customer_id)
        .neq('status', 'cancelled')
        .order('started_at', { ascending: false })
        .limit(200),
      scope.supabase
        .from('pro_crm_maintenance_plans')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', scope.ownerId)
        .eq('customer_id', plan.customer_id),
    ]);

    const contactRow = (contact as ContactRow | null) ?? undefined;
    const places = await loadPlaces(housePlaceIds([plan], [contactRow]));
    const location = houseLocation(plan, contactRow, places);
    const visits = ((visitRows ?? []) as Array<{
      id: string;
      customer_id: string;
      maintenance_plan_id: string | null;
      status: string;
      started_at: string;
      ended_at: string | null;
      duration_seconds: number | null;
      labor_seconds: number | null;
      worker_count: number | null;
    }>).filter((visit) => visitBelongsToHouse(visit, plan, plansForContact ?? 1));

    const today = todayKeyInZone(safeTimeZone(request.nextUrl.searchParams.get('timeZone')));
    return NextResponse.json({
      house: {
        id: plan.id,
        customerId: plan.customer_id,
        customerName: houseContactName(contactRow),
        phone: contactRow?.phone ?? null,
        email: contactRow?.email ?? null,
        placeId: plan.place_id,
        placeName: location.placeName,
        address: location.address,
        status: houseStatus(plan, today),
        name: plan.name,
        frequency: plan.frequency,
        amountCents: plan.amount_cents,
        nextVisitDate: plan.next_visit_date,
        endDate: plan.end_date,
        isActive: plan.is_active,
        scopeOfWork: plan.scope_of_work,
        accessNotes: plan.access_notes,
        summary: plan.summary,
        fromEstimate: Boolean(plan.source_estimate_id),
        createdAt: plan.created_at,
      },
      visits: visits.map((visit) => ({
        id: visit.id,
        status: visit.status,
        startedAt: visit.started_at,
        endedAt: visit.ended_at,
        durationSeconds: visit.duration_seconds,
        laborSeconds: visit.labor_seconds,
        workerCount: visit.worker_count ?? 1,
      })),
      businessId: scope.businessId,
      canEdit: !scope.isCrew,
    });
  } catch (error) {
    console.error('GET /api/crm/maintenance/houses/[id]', error);
    return NextResponse.json({ error: 'Failed to load the house' }, { status: 500 });
  }
}

const updateSchema = houseAgreementSchema.extend({ isActive: z.boolean().optional() });

/**
 * PATCH /api/crm/maintenance/houses/[id]
 * Edit the agreement: which house, schedule, price, the job, and access notes. Owner only.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    if (scope.isCrew) {
      return NextResponse.json({ error: 'Only the business owner can change the agreement.' }, { status: 403 });
    }
    const { id } = await params;
    const plan = await loadPlan(scope, id);
    if (!plan) return NextResponse.json({ error: 'House not found' }, { status: 404 });

    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid agreement' }, { status: 400 });
    }
    const input = parsed.data;
    const place = await pickDocPlaceId(plan.customer_id, input.placeId ?? null);
    if (!place.ok) return NextResponse.json({ error: place.error }, { status: 400 });

    const { error: updateError } = await scope.supabase
      .from('pro_crm_maintenance_plans')
      .update({
        ...agreementColumns(input),
        place_id: place.placeId,
        ...(input.isActive === undefined ? {} : { is_active: input.isActive }),
      })
      .eq('id', plan.id)
      .eq('owner_id', scope.ownerId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/crm/maintenance/houses/[id]', error);
    return NextResponse.json({ error: 'Failed to save the agreement' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/maintenance/houses/[id]
 * Remove the house (its maintenance agreement and plant list). Visits already recorded stay in
 * the visit history without a house. Refused while a visit is running there.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    if (scope.isCrew) {
      return NextResponse.json({ error: 'Only the business owner can delete a house.' }, { status: 403 });
    }
    const { id } = await params;
    const plan = await loadPlan(scope, id);
    if (!plan) return NextResponse.json({ error: 'House not found' }, { status: 404 });

    const { data: running } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .select('id')
      .eq('owner_id', scope.ownerId)
      .eq('maintenance_plan_id', plan.id)
      .in('status', ['in_progress', 'on_break'])
      .limit(1)
      .maybeSingle();
    if (running) {
      return NextResponse.json({ error: 'A visit is running at this house. Finish it first.' }, { status: 409 });
    }

    const { error: deleteError } = await scope.supabase
      .from('pro_crm_maintenance_plans')
      .delete()
      .eq('id', plan.id)
      .eq('owner_id', scope.ownerId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/crm/maintenance/houses/[id]', error);
    return NextResponse.json({ error: 'Failed to delete the house' }, { status: 500 });
  }
}

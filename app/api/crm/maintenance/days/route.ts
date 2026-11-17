import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import {
  closeOpenTripOnDay,
  ensureOpenMaintenanceDay,
  mapDay,
  recomputeDayTotals,
  type MaintenanceDayRow,
} from '@/lib/crm/maintenance-day-db';
const patchSchema = z.object({
  action: z.enum(['end_day', 'start_trip']),
  fromVisitId: z.string().uuid().optional(),
  miles: z.number().min(0).max(9999).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

/**
 * GET /api/crm/maintenance/days
 * Current open day (auto-created summary) plus recent closed days.
 */
export async function GET() {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;

    const { data: open } = await scope.supabase
      .from('pro_crm_maintenance_days')
      .select('*')
      .eq('owner_id', scope.ownerId)
      .eq('status', 'open')
      .maybeSingle();

    let day = open as MaintenanceDayRow | null;
    if (day) {
      await recomputeDayTotals(scope.supabase, day.id, scope.ownerId);
      const { data: refreshed } = await scope.supabase
        .from('pro_crm_maintenance_days')
        .select('*')
        .eq('id', day.id)
        .single();
      day = refreshed as MaintenanceDayRow;
    }

    const { data: trips } = day
      ? await scope.supabase
          .from('pro_crm_maintenance_day_trips')
          .select('id, from_visit_id, to_visit_id, from_customer_id, to_customer_id, started_at, ended_at, duration_seconds, miles, note')
          .eq('day_id', day.id)
          .order('started_at', { ascending: true })
      : { data: [] };

    const { data: recent } = await scope.supabase
      .from('pro_crm_maintenance_days')
      .select('*')
      .eq('owner_id', scope.ownerId)
      .order('work_date', { ascending: false })
      .limit(14);

    return NextResponse.json({
      day: day ? mapDay(day) : null,
      trips: (trips ?? []).map((trip) => ({
        id: trip.id,
        fromVisitId: trip.from_visit_id,
        toVisitId: trip.to_visit_id,
        fromCustomerId: trip.from_customer_id,
        toCustomerId: trip.to_customer_id,
        startedAt: trip.started_at,
        endedAt: trip.ended_at,
        durationSeconds: trip.duration_seconds,
        miles: trip.miles,
        note: trip.note,
        isOpen: !trip.ended_at,
      })),
      recentDays: ((recent ?? []) as MaintenanceDayRow[]).map(mapDay),
    });
  } catch (error) {
    console.error('GET /api/crm/maintenance/days', error);
    return NextResponse.json({ error: 'Failed to load day' }, { status: 500 });
  }
}

/**
 * PATCH /api/crm/maintenance/days
 * Start a trip between places, or end the maintenance day.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid action' }, { status: 400 });
    }

    if (parsed.data.action === 'start_trip') {
      const day = await ensureOpenMaintenanceDay(scope.supabase, scope.ownerId, scope.businessId);

      const { data: openVisit } = await scope.supabase
        .from('pro_crm_maintenance_visits')
        .select('id, status')
        .eq('owner_id', scope.ownerId)
        .in('status', ['in_progress', 'on_break'])
        .limit(1)
        .maybeSingle();
      if (openVisit) {
        return NextResponse.json(
          { error: 'Finish the current maintenance visit before starting travel' },
          { status: 400 }
        );
      }

      const { data: existingTrip } = await scope.supabase
        .from('pro_crm_maintenance_day_trips')
        .select('id')
        .eq('day_id', day.id)
        .is('ended_at', null)
        .maybeSingle();
      if (existingTrip) {
        return NextResponse.json({ error: 'A trip is already in progress' }, { status: 400 });
      }

      let fromVisitId = parsed.data.fromVisitId ?? null;
      let fromCustomerId: string | null = null;
      if (!fromVisitId) {
        const { data: lastVisit } = await scope.supabase
          .from('pro_crm_maintenance_visits')
          .select('id, customer_id')
          .eq('day_id', day.id)
          .eq('status', 'completed')
          .order('ended_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        fromVisitId = lastVisit?.id ?? null;
        fromCustomerId = lastVisit?.customer_id ?? null;
      } else {
        const { data: fromVisit } = await scope.supabase
          .from('pro_crm_maintenance_visits')
          .select('id, customer_id')
          .eq('id', fromVisitId)
          .eq('owner_id', scope.ownerId)
          .maybeSingle();
        fromCustomerId = fromVisit?.customer_id ?? null;
      }

      const { data: trip, error: tripError } = await scope.supabase
        .from('pro_crm_maintenance_day_trips')
        .insert({
          day_id: day.id,
          owner_id: scope.ownerId,
          from_visit_id: fromVisitId,
          from_customer_id: fromCustomerId,
          started_at: new Date().toISOString(),
          miles: parsed.data.miles ?? null,
          note: parsed.data.note ?? null,
        })
        .select('*')
        .single();

      if (tripError || !trip) {
        return NextResponse.json({ error: tripError?.message ?? 'Could not start trip' }, { status: 500 });
      }

      return NextResponse.json({
        trip: {
          id: trip.id,
          startedAt: trip.started_at,
          fromVisitId: trip.from_visit_id,
          isOpen: true,
        },
        day: mapDay(day),
      });
    }

    // end_day
    const { data: open } = await scope.supabase
      .from('pro_crm_maintenance_days')
      .select('*')
      .eq('owner_id', scope.ownerId)
      .eq('status', 'open')
      .maybeSingle();

    if (!open) {
      return NextResponse.json({ error: 'No open maintenance day' }, { status: 400 });
    }

    const { data: openVisit } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .select('id, status')
      .eq('owner_id', scope.ownerId)
      .in('status', ['in_progress', 'on_break'])
      .limit(1)
      .maybeSingle();
    if (openVisit) {
      return NextResponse.json(
        { error: 'Finish the last maintenance visit before ending the day' },
        { status: 400 }
      );
    }

    await closeOpenTripOnDay(scope.supabase, open.id, scope.ownerId);
    await recomputeDayTotals(scope.supabase, open.id, scope.ownerId);

    const { data: closed, error: closeError } = await scope.supabase
      .from('pro_crm_maintenance_days')
      .update({
        status: 'closed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', open.id)
      .select('*')
      .single();

    if (closeError || !closed) {
      return NextResponse.json({ error: closeError?.message ?? 'Could not end day' }, { status: 500 });
    }

    return NextResponse.json({ day: mapDay(closed as MaintenanceDayRow) });
  } catch (error) {
    console.error('PATCH /api/crm/maintenance/days', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update day' },
      { status: 500 }
    );
  }
}

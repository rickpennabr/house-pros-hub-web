import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { actorLabel, loadScopedProject } from '@/lib/crm/project-access';
import { parseTripWrite } from '@/lib/crm/mileage-cost';
import { MILEAGE_SETUP_ERROR, mileageSchemaMissing, presentTrip, priceTrip, tripColumns, vehicleFromRow } from '@/lib/crm/mileage';

type Params = { params: Promise<{ id: string }> };
type Row = Record<string, unknown>;

function tripOut(row: Row) {
  const view = presentTrip(row as never, false);
  return { ...view, by: (row.created_by_name as string | null) ?? null };
}

/**
 * GET /api/crm/projects/[id]/trips
 *   projectTrips: trips driven for the work (job, supply run, other). Direct project cost.
 *   estimateTrips: visits to give the estimate. Cost of selling: they go to company costs,
 *   not to this project's profit.
 *   vehicles: the owner's vehicles that have a cost per mile, for logging a trip.
 * POST — log a project trip (owner and crew) { vehicleId, tripDate, purpose, miles, origin, destination, note }.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    const project = await loadScopedProject(scope, (await params).id);
    if (project instanceof NextResponse) return project;

    const db = scope.supabase;
    const [projectTrips, estimateTrips, vehicles] = await Promise.all([
      db
        .from('pro_crm_mileage_trips')
        .select('*')
        .eq('owner_id', scope.ownerId)
        .eq('project_id', project.id)
        .neq('purpose', 'estimate')
        .order('trip_date', { ascending: false }),
      // Estimate visits for this job: tied to its estimate, or estimate trips for this customer before the project.
      project.estimate_id || project.customer_id
        ? db
            .from('pro_crm_mileage_trips')
            .select('*')
            .eq('owner_id', scope.ownerId)
            .eq('purpose', 'estimate')
            .or(
              [
                project.estimate_id ? `estimate_id.eq.${project.estimate_id}` : null,
                `project_id.eq.${project.id}`,
                project.customer_id ? `and(customer_id.eq.${project.customer_id},project_id.is.null)` : null,
              ]
                .filter(Boolean)
                .join(',')
            )
            .order('trip_date', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      db.from('pro_crm_vehicles').select('*').eq('owner_id', scope.ownerId).order('name'),
    ]);
    const failure = projectTrips.error ?? estimateTrips.error ?? vehicles.error;
    if (failure) {
      if (mileageSchemaMissing(failure.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: failure.message }, { status: 500 });
    }

    return NextResponse.json({
      projectTrips: ((projectTrips.data ?? []) as Row[]).map(tripOut),
      estimateTrips: ((estimateTrips.data ?? []) as Row[]).map(tripOut),
      vehicles: ((vehicles.data ?? []) as Row[]).map((row) => {
        const priced = priceTrip(vehicleFromRow(row as never), 1);
        return { id: String(row.id), name: String(row.name), costPerMileCents: 'error' in priced ? null : priced.costPerMileCents };
      }),
    });
  } catch (err) {
    console.error('GET project trips', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    const project = await loadScopedProject(scope, (await params).id);
    if (project instanceof NextResponse) return project;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    // Estimate visits are logged on the estimate (Mileage page); a project trip is work for the project.
    const purpose = body?.purpose === 'supply_run' || body?.purpose === 'other' ? body.purpose : 'job';
    const parsed = parseTripWrite({ ...(body ?? {}), purpose, projectId: project.id, customerId: project.customer_id, estimateId: null });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { data: vehicle, error: vehicleError } = await scope.supabase
      .from('pro_crm_vehicles')
      .select('*')
      .eq('id', parsed.value.vehicleId)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (vehicleError) {
      if (mileageSchemaMissing(vehicleError.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: vehicleError.message }, { status: 500 });
    }
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

    const priced = priceTrip(vehicleFromRow(vehicle as never), parsed.value.miles);
    if ('error' in priced) return NextResponse.json({ error: priced.error }, { status: 400 });

    const base = tripColumns(scope.ownerId, parsed.value, String((vehicle as Row).name), priced);
    const withAuthor = { ...base, created_by: scope.actorId, created_by_name: await actorLabel(scope) };
    let insert = await scope.supabase.from('pro_crm_mileage_trips').insert(withAuthor).select('id').single();
    // Before migration 169 the author columns do not exist yet.
    if (insert.error && /created_by/i.test(insert.error.message)) {
      insert = await scope.supabase.from('pro_crm_mileage_trips').insert(base).select('id').single();
    }
    if (insert.error) return NextResponse.json({ error: insert.error.message }, { status: 500 });
    return NextResponse.json({ id: (insert.data as { id: string }).id, amountCents: priced.amountCents }, { status: 201 });
  } catch (err) {
    console.error('POST project trip', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

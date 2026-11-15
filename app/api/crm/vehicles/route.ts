import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { parseVehicleWrite } from '@/lib/crm/mileage-cost';
import {
  MILEAGE_SETUP_ERROR,
  mileageSchemaMissing,
  presentVehicle,
  trailingYear,
  vehicleColumns,
} from '@/lib/crm/mileage';

/**
 * GET /api/crm/vehicles
 * Vehicles with the typed cost and the cost implied by tagged expenses over the last year.
 * POST /api/crm/vehicles — create one vehicle.
 */
export async function GET() {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { from, to } = trailingYear();
    const { data: vehicles, error } = await supabase
      .from('pro_crm_vehicles')
      .select('*')
      .eq('owner_id', user.id)
      .order('name', { ascending: true });
    if (error) {
      if (mileageSchemaMissing(error.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const [{ data: expenses, error: expenseError }, { data: trips, error: tripError }] = await Promise.all([
      supabase
        .from('pro_crm_expenses')
        .select('vehicle_id, category, amount_cents')
        .eq('owner_id', user.id)
        .gte('expense_date', from)
        .lte('expense_date', to)
        .not('vehicle_id', 'is', null)
        .limit(2000),
      supabase
        .from('pro_crm_mileage_trips')
        .select('vehicle_id, miles')
        .eq('owner_id', user.id)
        .gte('trip_date', from)
        .lte('trip_date', to)
        .limit(2000),
    ]);
    if (expenseError) {
      if (mileageSchemaMissing(expenseError.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: expenseError.message }, { status: 500 });
    }
    if (tripError && !mileageSchemaMissing(tripError.message)) {
      return NextResponse.json({ error: tripError.message }, { status: 500 });
    }

    const loggedMiles = new Map<string, number>();
    for (const trip of trips ?? []) {
      if (!trip.vehicle_id) continue;
      const miles = typeof trip.miles === 'number' ? trip.miles : Number(trip.miles);
      if (!Number.isFinite(miles)) continue;
      loggedMiles.set(trip.vehicle_id, (loggedMiles.get(trip.vehicle_id) ?? 0) + miles);
    }

    const expenseRows = (expenses ?? []).map((row) => ({
      vehicleId: row.vehicle_id,
      category: row.category,
      amountCents: row.amount_cents,
    }));

    return NextResponse.json({
      from,
      to,
      vehicles: (vehicles ?? []).map((row) => presentVehicle(row, expenseRows, loggedMiles)),
    });
  } catch (err) {
    console.error('GET /api/crm/vehicles', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const parsed = parseVehicleWrite(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { data, error } = await supabase
      .from('pro_crm_vehicles')
      .insert({ owner_id: user.id, ...vehicleColumns(parsed.value) })
      .select('id')
      .single();
    if (error) {
      if (mileageSchemaMissing(error.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/vehicles', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

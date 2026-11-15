import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { parseTripWrite } from '@/lib/crm/mileage-cost';
import {
  MILEAGE_SETUP_ERROR,
  mileageSchemaMissing,
  presentTrip,
  priceTrip,
  resolveTripLinks,
  tripColumns,
  tripListNames,
  vehicleFromRow,
} from '@/lib/crm/mileage';

/**
 * GET /api/crm/mileage/trips — recent trips, newest first.
 * POST /api/crm/mileage/trips — price a trip from the saved vehicle. Does not create an expense.
 */
export async function GET() {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { data: trips, error } = await supabase
      .from('pro_crm_mileage_trips')
      .select('*')
      .eq('owner_id', user.id)
      .order('trip_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      if (mileageSchemaMissing(error.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const expenseIds = (trips ?? []).map((trip) => trip.expense_id).filter((id): id is string => Boolean(id));
    const billed = new Set<string>();
    if (expenseIds.length > 0) {
      const { data: expenses, error: expenseError } = await supabase
        .from('pro_crm_expenses')
        .select('id, billed_invoice_id')
        .eq('owner_id', user.id)
        .in('id', expenseIds);
      if (expenseError) return NextResponse.json({ error: expenseError.message }, { status: 500 });
      for (const expense of expenses ?? []) {
        if (expense.billed_invoice_id) billed.add(expense.id);
      }
    }

    const views = (trips ?? []).map((trip) => presentTrip(trip, trip.expense_id ? billed.has(trip.expense_id) : false));
    return NextResponse.json({ trips: await tripListNames(supabase, user.id, views) });
  } catch (err) {
    console.error('GET /api/crm/mileage/trips', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const parsed = parseTripWrite(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const links = await resolveTripLinks(supabase, user.id, parsed.value);
    if ('error' in links) return NextResponse.json({ error: links.error }, { status: links.status });
    const write = { ...parsed.value, ...links };

    const { data: vehicle, error: vehicleError } = await supabase
      .from('pro_crm_vehicles')
      .select('*')
      .eq('id', parsed.value.vehicleId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (vehicleError) {
      if (mileageSchemaMissing(vehicleError.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: vehicleError.message }, { status: 500 });
    }
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

    const priced = priceTrip(vehicleFromRow(vehicle), write.miles);
    if ('error' in priced) return NextResponse.json({ error: priced.error }, { status: 400 });

    const { data: trip, error: tripError } = await supabase
      .from('pro_crm_mileage_trips')
      .insert(tripColumns(user.id, write, vehicle.name, priced))
      .select('id')
      .single();
    if (tripError || !trip) {
      if (tripError && mileageSchemaMissing(tripError.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: tripError?.message || 'Failed to save the trip' }, { status: 500 });
    }

    return NextResponse.json({ id: trip.id, amountCents: priced.amountCents }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/mileage/trips', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

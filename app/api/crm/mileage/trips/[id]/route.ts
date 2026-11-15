import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { parseTripWrite } from '@/lib/crm/mileage-cost';
import {
  MILEAGE_SETUP_ERROR,
  mileageSchemaMissing,
  priceTrip,
  resolveTripLinks,
  tripColumns,
  vehicleFromRow,
} from '@/lib/crm/mileage';

/**
 * PUT /api/crm/mileage/trips/[id] — reprice from the vehicle's current inputs.
 * DELETE /api/crm/mileage/trips/[id] — remove the trip. Tagged fuel and insurance expenses stay.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Trip id required' }, { status: 400 });

    const parsed = parseTripWrite(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { data: existing, error: readError } = await supabase
      .from('pro_crm_mileage_trips')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (readError) {
      if (mileageSchemaMissing(readError.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const links = await resolveTripLinks(supabase, user.id, parsed.value);
    if ('error' in links) return NextResponse.json({ error: links.error }, { status: links.status });
    const write = { ...parsed.value, ...links };

    const { data: vehicle, error: vehicleError } = await supabase
      .from('pro_crm_vehicles')
      .select('*')
      .eq('id', parsed.value.vehicleId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (vehicleError) return NextResponse.json({ error: vehicleError.message }, { status: 500 });
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

    const priced = priceTrip(vehicleFromRow(vehicle), parsed.value.miles);
    if ('error' in priced) return NextResponse.json({ error: priced.error }, { status: 400 });

    if (existing.expense_id) {
      const { data: linked } = await supabase
        .from('pro_crm_expenses')
        .select('billed_invoice_id')
        .eq('id', existing.expense_id)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (linked?.billed_invoice_id) return NextResponse.json({ error: 'This trip is already on an invoice.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('pro_crm_mileage_trips')
      .update(tripColumns(user.id, write, vehicle.name, priced))
      .eq('id', id)
      .eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id, amountCents: priced.amountCents });
  } catch (err) {
    console.error('PUT /api/crm/mileage/trips/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Trip id required' }, { status: 400 });

    const { data: existing, error: readError } = await supabase
      .from('pro_crm_mileage_trips')
      .select('id, expense_id')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    if (existing.expense_id) {
      const { data: linked } = await supabase
        .from('pro_crm_expenses')
        .select('billed_invoice_id')
        .eq('id', existing.expense_id)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (linked?.billed_invoice_id) return NextResponse.json({ error: 'This trip is already on an invoice.' }, { status: 400 });
    }

    const { error } = await supabase.from('pro_crm_mileage_trips').delete().eq('id', id).eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/mileage/trips/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

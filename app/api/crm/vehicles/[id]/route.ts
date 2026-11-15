import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { parseVehicleWrite } from '@/lib/crm/mileage-cost';
import { MILEAGE_SETUP_ERROR, mileageSchemaMissing, vehicleColumns } from '@/lib/crm/mileage';

/**
 * PUT /api/crm/vehicles/[id] — replace the cost inputs.
 * DELETE /api/crm/vehicles/[id] — remove the vehicle. Saved trips keep their snapshotted cost.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Vehicle id required' }, { status: 400 });

    const parsed = parseVehicleWrite(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { data, error } = await supabase
      .from('pro_crm_vehicles')
      .update(vehicleColumns(parsed.value))
      .eq('id', id)
      .eq('owner_id', user.id)
      .select('id')
      .maybeSingle();
    if (error) {
      if (mileageSchemaMissing(error.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('PUT /api/crm/vehicles/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Vehicle id required' }, { status: 400 });

    const { error } = await supabase.from('pro_crm_vehicles').delete().eq('id', id).eq('owner_id', user.id);
    if (error) {
      if (mileageSchemaMissing(error.message)) return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/vehicles/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

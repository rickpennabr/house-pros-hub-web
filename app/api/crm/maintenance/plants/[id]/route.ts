import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { listPlants, loadOwnedPlant } from '@/lib/crm/maintenance-plants-db';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  quantity: z.number().int().min(1).max(9999).optional(),
  area: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/crm/maintenance/plants/[id] */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await context.params;
    const plant = await loadOwnedPlant(scope.supabase, scope.ownerId, id);
    if (!plant) return NextResponse.json({ error: 'Plant not found' }, { status: 404 });

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid plant' }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.quantity !== undefined) updates.quantity = parsed.data.quantity;
    if (parsed.data.area !== undefined) updates.area = parsed.data.area || null;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes || null;
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await scope.supabase
        .from('pro_crm_maintenance_plants')
        .update(updates)
        .eq('id', id)
        .eq('owner_id', scope.ownerId);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    const next = (await listPlants(scope.supabase, scope.ownerId, plant.customer_id)).find((item) => item.id === id);
    return NextResponse.json({ plant: next });
  } catch (error) {
    console.error('PATCH /api/crm/maintenance/plants/[id]', error);
    return NextResponse.json({ error: 'Failed to update plant' }, { status: 500 });
  }
}

/** DELETE /api/crm/maintenance/plants/[id]. Photos stay in ProDrive. */
export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await context.params;
    const plant = await loadOwnedPlant(scope.supabase, scope.ownerId, id);
    if (!plant) return NextResponse.json({ error: 'Plant not found' }, { status: 404 });
    const { error: deleteError } = await scope.supabase
      .from('pro_crm_maintenance_plants')
      .delete()
      .eq('id', id)
      .eq('owner_id', scope.ownerId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/crm/maintenance/plants/[id]', error);
    return NextResponse.json({ error: 'Failed to remove plant' }, { status: 500 });
  }
}

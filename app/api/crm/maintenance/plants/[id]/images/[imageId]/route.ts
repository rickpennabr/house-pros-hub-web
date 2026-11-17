import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { listPlants, loadOwnedPlant } from '@/lib/crm/maintenance-plants-db';

/** DELETE /api/crm/maintenance/plants/[id]/images/[imageId]. The file stays in ProDrive. */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id, imageId } = await context.params;
    const plant = await loadOwnedPlant(scope.supabase, scope.ownerId, id);
    if (!plant) return NextResponse.json({ error: 'Plant not found' }, { status: 404 });
    const { error: deleteError } = await scope.supabase
      .from('pro_crm_maintenance_plant_images')
      .delete()
      .eq('id', imageId)
      .eq('plant_id', id)
      .eq('owner_id', scope.ownerId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    const next = (await listPlants(scope.supabase, scope.ownerId, plant.customer_id)).find((item) => item.id === id);
    return NextResponse.json({ plant: next });
  } catch (error) {
    console.error('DELETE /api/crm/maintenance/plants/[id]/images/[imageId]', error);
    return NextResponse.json({ error: 'Failed to remove photo' }, { status: 500 });
  }
}

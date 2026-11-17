import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import {
  PLANT_IMAGE_LIMIT,
  driveFileBelongsToScope,
  listPlants,
  loadOwnedPlant,
} from '@/lib/crm/maintenance-plants-db';

const postSchema = z.object({ driveFileId: z.string().uuid() });

/**
 * POST /api/crm/maintenance/plants/[id]/images
 * Attach a ProDrive photo (uploaded by this business) to a plant.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await context.params;
    const plant = await loadOwnedPlant(scope.supabase, scope.ownerId, id);
    if (!plant) return NextResponse.json({ error: 'Plant not found' }, { status: 404 });

    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid photo' }, { status: 400 });

    const file = await driveFileBelongsToScope(scope, parsed.data.driveFileId);
    if (!file) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    if (!(file.mime_type ?? '').toLowerCase().startsWith('image/')) {
      return NextResponse.json({ error: 'Plants take photos only' }, { status: 400 });
    }

    const { data: existing } = await scope.supabase
      .from('pro_crm_maintenance_plant_images')
      .select('sort_order')
      .eq('plant_id', id)
      .order('sort_order', { ascending: false });
    if ((existing ?? []).length >= PLANT_IMAGE_LIMIT) {
      return NextResponse.json({ error: `Up to ${PLANT_IMAGE_LIMIT} photos per plant` }, { status: 400 });
    }

    const { error: insertError } = await scope.supabase.from('pro_crm_maintenance_plant_images').insert({
      plant_id: id,
      owner_id: scope.ownerId,
      drive_file_id: file.id,
      sort_order: ((existing ?? [])[0]?.sort_order ?? -1) + 1,
    });
    // 23505 = the same photo is already on this plant; treat as done.
    if (insertError && insertError.code !== '23505') {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const next = (await listPlants(scope.supabase, scope.ownerId, plant.customer_id)).find((item) => item.id === id);
    return NextResponse.json({ plant: next }, { status: 201 });
  } catch (error) {
    console.error('POST /api/crm/maintenance/plants/[id]/images', error);
    return NextResponse.json({ error: 'Failed to add photo' }, { status: 500 });
  }
}

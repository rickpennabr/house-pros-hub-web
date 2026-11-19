import type { CrmDb, CrmScope } from '@/lib/crm/crm-scope';
import { PRO_DRIVE_BUCKET, PRO_DRIVE_SIGNED_URL_SECONDS } from '@/lib/drive/constants';

export const PLANT_IMAGE_LIMIT = 8;

export interface MaintenancePlant {
  id: string;
  customerId: string;
  /** House (agreement) the plant is at. Null: shared by the contact's houses. */
  planId: string | null;
  name: string;
  quantity: number;
  area: string | null;
  notes: string | null;
  sortOrder: number;
  images: Array<{ id: string; driveFileId: string; url: string | null }>;
  createdAt: string;
  updatedAt: string;
}

type PlantRow = {
  id: string;
  customer_id: string;
  plan_id: string | null;
  name: string;
  quantity: number;
  area: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function customerBelongsToOwner(db: CrmDb, ownerId: string, customerId: string): Promise<boolean> {
  const { data } = await db
    .from('pro_crm_customers')
    .select('id')
    .eq('id', customerId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  return Boolean(data);
}

export async function loadOwnedPlant(db: CrmDb, ownerId: string, plantId: string): Promise<PlantRow | null> {
  const { data } = await db
    .from('pro_crm_maintenance_plants')
    .select('id, customer_id, plan_id, name, quantity, area, notes, sort_order, created_at, updated_at')
    .eq('id', plantId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  return (data as PlantRow | null) ?? null;
}

/**
 * True when the ProDrive file belongs to this business. Without this, any file id
 * could be attached and served back through a signed URL.
 */
export async function driveFileBelongsToScope(scope: CrmScope, driveFileId: string) {
  if (!scope.businessId) return null;
  const { data } = await scope.supabase
    .from('pro_drive_files')
    .select('id, mime_type, name')
    .eq('id', driveFileId)
    .eq('owner_type', 'business')
    .eq('owner_id', scope.businessId)
    .maybeSingle();
  return (data as { id: string; mime_type: string | null; name: string } | null) ?? null;
}

export async function listPlants(
  db: CrmDb,
  ownerId: string,
  customerId: string,
  /** planId: only that house's plants, plus older plants shared by all of the contact's houses. */
  opts: { withImageUrls?: boolean; planId?: string | null } = {}
): Promise<MaintenancePlant[]> {
  let query = db
    .from('pro_crm_maintenance_plants')
    .select('id, customer_id, plan_id, name, quantity, area, notes, sort_order, created_at, updated_at')
    .eq('owner_id', ownerId)
    .eq('customer_id', customerId);
  if (opts.planId) query = query.or(`plan_id.eq.${opts.planId},plan_id.is.null`);
  const { data: rows, error } = await query
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  const plants = (rows ?? []) as PlantRow[];
  if (plants.length === 0) return [];

  const { data: imageRows } = await db
    .from('pro_crm_maintenance_plant_images')
    .select('id, plant_id, drive_file_id, sort_order')
    .in(
      'plant_id',
      plants.map((plant) => plant.id)
    )
    .order('sort_order', { ascending: true });
  const images = (imageRows ?? []) as Array<{ id: string; plant_id: string; drive_file_id: string; sort_order: number }>;

  const urlByFile = new Map<string, string | null>();
  if (opts.withImageUrls !== false && images.length > 0) {
    const { data: files } = await db
      .from('pro_drive_files')
      .select('id, storage_path')
      .in(
        'id',
        images.map((image) => image.drive_file_id)
      );
    const paths = ((files ?? []) as Array<{ id: string; storage_path: string }>).filter((file) => file.storage_path);
    if (paths.length > 0) {
      const { data: signed } = await db.storage
        .from(PRO_DRIVE_BUCKET)
        .createSignedUrls(
          paths.map((file) => file.storage_path),
          PRO_DRIVE_SIGNED_URL_SECONDS
        );
      paths.forEach((file, index) => urlByFile.set(file.id, signed?.[index]?.signedUrl ?? null));
    }
  }

  return plants.map((plant) => ({
    id: plant.id,
    customerId: plant.customer_id,
    planId: plant.plan_id ?? null,
    name: plant.name,
    quantity: plant.quantity,
    area: plant.area,
    notes: plant.notes,
    sortOrder: plant.sort_order,
    createdAt: plant.created_at,
    updatedAt: plant.updated_at,
    images: images
      .filter((image) => image.plant_id === plant.id)
      .map((image) => ({ id: image.id, driveFileId: image.drive_file_id, url: urlByFile.get(image.drive_file_id) ?? null })),
  }));
}

/** True when the maintenance house (agreement) belongs to this owner and contact. */
export async function planBelongsToCustomer(
  db: CrmDb,
  ownerId: string,
  customerId: string,
  planId: string
): Promise<boolean> {
  const { data } = await db
    .from('pro_crm_maintenance_plans')
    .select('id')
    .eq('id', planId)
    .eq('owner_id', ownerId)
    .eq('customer_id', customerId)
    .maybeSingle();
  return Boolean(data);
}

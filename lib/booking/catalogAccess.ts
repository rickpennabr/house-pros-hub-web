import { createServiceRoleClient } from '@/lib/supabase/server';
import { invalidateBusinessDirectoryCache } from '@/lib/data/businessDirectory';
import {
  dollarsToCents,
  type BookingServiceInput,
  type CatalogService,
  type ServicePriceType,
  type ServiceUnit,
} from '@/lib/booking/catalogService';
import type { PriceMode } from '@/lib/crm/catalog-options';
import {
  createService,
  deleteService,
  isMissingCatalogTable,
  listServices,
  releaseStoragePaths,
  updateService,
  type CrmService,
} from '@/lib/crm/catalog-db';
import type { CatalogImageInput, ServiceWriteInput } from '@/lib/schemas/crm-catalog';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

interface BusinessRef {
  id: string;
  owner_id: string | null;
  is_active: boolean | null;
}

interface ServiceRow {
  id: string;
  business_id: string;
  name: string;
  description: string;
  category: string;
  price_cents: number;
  price_max_cents: number | null;
  price_type: ServicePriceType;
  unit: ServiceUnit;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export function isMissingServicesTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('pro_booking_services');
}

export function mapCatalogService(row: ServiceRow): CatalogService {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description ?? '',
    category: row.category ?? '',
    priceCents: row.price_cents ?? 0,
    priceMaxCents: row.price_max_cents,
    priceType: row.price_type,
    unit: row.unit,
    imageUrl: row.image_url,
    imageUrls: row.image_url ? [row.image_url] : [],
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active,
  };
}

export async function resolveBusiness(idOrSlug: string): Promise<BusinessRef | null> {
  const service = createServiceRoleClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  let query = service.from('businesses').select('id, owner_id, is_active');
  query = isUuid ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug).eq('is_active', true);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function ownerCanManageServices(userId: string): Promise<boolean> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) return false;
  return (data ?? []).some(
    (row) =>
      row.role === 'contractor' ||
      row.role === 'realtor' ||
      row.role === 'installer' ||
      row.role === 'handyman'
  );
}

export async function ownerIsContractor(userId: string): Promise<boolean> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) return false;
  return (data ?? []).some((row) => row.role === 'contractor');
}

const UNIT_ALIASES: Record<string, ServiceUnit> = {
  sqft: 'sqft',
  sf: 'sqft',
  squarefeet: 'sqft',
  squarefoot: 'sqft',
  hour: 'hour',
  hr: 'hour',
  hours: 'hour',
  each: 'each',
  ea: 'each',
  job: 'job',
};

const PUBLIC_UNIT_LABEL: Record<ServiceUnit, string> = {
  job: 'job',
  hour: 'hour',
  sqft: 'sq ft',
  each: 'each',
};

export function canonicalServiceUnit(value: string): ServiceUnit {
  const key = value.trim().toLowerCase().replace(/[.\s]/g, '');
  return UNIT_ALIASES[key] ?? 'each';
}

function catalogImageUrls(images: CrmService['images']): string[] {
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const thumb = sorted.find((image) => image.is_thumbnail) ?? sorted[0];
  const ordered = thumb ? [thumb, ...sorted.filter((image) => image !== thumb)] : [];
  const urls: string[] = [];
  for (const image of ordered) {
    const url = image.image_url.trim();
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function mapCrmService(service: CrmService, businessId: string, sortOrder: number): CatalogService {
  const priceType: ServicePriceType =
    service.price_mode === 'range' ? 'range' : service.price_mode === 'flat' ? 'starting_at' : 'fixed';
  const imageUrls = catalogImageUrls(service.images);
  return {
    id: service.id,
    businessId,
    name: service.name,
    description: service.description ?? '',
    category: service.category ?? '',
    priceCents: service.price_mode === 'range' ? (service.price_min_cents ?? service.price_cents) : service.price_cents,
    priceMaxCents: service.price_mode === 'range' ? service.price_max_cents : null,
    priceType,
    unit: canonicalServiceUnit(service.unit),
    unitLabel: service.unit.trim() || undefined,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    sortOrder,
    isActive: true,
  };
}

function publicPriceMode(input: BookingServiceInput): PriceMode {
  if (input.priceType === 'range') return 'range';
  if (input.priceType === 'starting_at') return 'flat';
  return 'unit';
}

function publicPriceTypeLabel(mode: PriceMode): string {
  if (mode === 'range') return 'Range price';
  if (mode === 'flat') return 'Start at';
  return 'Unit price';
}

function crmUnitLabel(input: BookingServiceInput, existing?: CrmService): string {
  const requested = input.unitLabel?.trim() ?? '';
  if (requested && canonicalServiceUnit(requested) === input.unit) return requested.slice(0, 40);
  if (!requested && existing && canonicalServiceUnit(existing.unit) === input.unit) {
    return existing.unit.slice(0, 40);
  }
  return PUBLIC_UNIT_LABEL[input.unit];
}

function toCrmWrite(input: BookingServiceInput, existing?: CrmService): ServiceWriteInput {
  const mode = publicPriceMode(input);
  const priceCents = dollarsToCents(input.price);
  const priceMax = input.priceType === 'range' && input.priceMax != null ? dollarsToCents(input.priceMax) : null;
  return {
    name: input.name,
    category: input.category,
    trade: existing?.trade ?? '',
    description: input.description,
    unit: crmUnitLabel(input, existing),
    price_type: existing && existing.price_mode === mode ? existing.price_type : publicPriceTypeLabel(mode),
    price_mode: mode,
    price_cents: priceCents,
    price_min_cents: mode === 'range' ? priceCents : null,
    price_max_cents: mode === 'range' ? priceMax : null,
    images: [],
  };
}

function nextCrmImages(
  input: BookingServiceInput,
  existing: CrmService
): { replaceImages: boolean; images: CatalogImageInput[] } {
  const nextUrl = input.imageUrl?.trim() ?? '';
  const current = existing.images.find((image) => image.is_thumbnail)?.image_url ?? existing.images[0]?.image_url ?? '';
  if (nextUrl === current) return { replaceImages: false, images: [] };
  if (!nextUrl) return { replaceImages: true, images: [] };
  const kept = existing.images
    .filter((image) => image.image_url !== nextUrl)
    .map((image) => ({
      image_url: image.image_url,
      storage_path: image.storage_path,
      is_thumbnail: false,
    }));
  return {
    replaceImages: true,
    images: [{ image_url: nextUrl, is_thumbnail: true }, ...kept].slice(0, 5),
  };
}

async function loadOwnerCrmServices(ownerId: string): Promise<CrmService[] | null> {
  try {
    return await listServices(createServiceRoleClient(), ownerId);
  } catch (error) {
    if (isMissingCatalogTable(error as { code?: string; message?: string })) return null;
    throw error;
  }
}

async function syncListedNames(client: ServiceClient, businessId: string, names: string[]): Promise<void> {
  const cleaned = names.map((name) => name.trim()).filter((name) => name.length > 0);
  const current = await client.from('businesses').select('services').eq('id', businessId).maybeSingle();
  if (current.error) return;
  const existing = Array.isArray(current.data?.services) ? current.data.services.map((name) => String(name)) : [];
  if (existing.length === cleaned.length && existing.every((name, index) => name === cleaned[index])) return;
  const updated = await client.from('businesses').update({ services: cleaned }).eq('id', businessId);
  if (!updated.error) invalidateBusinessDirectoryCache();
}

export async function listCatalogServices(
  businessId: string,
  includeInactive: boolean
): Promise<{ services: CatalogService[]; ready: boolean; source: 'crm' | 'booking' }> {
  const service = createServiceRoleClient();
  const owner = await service.from('businesses').select('owner_id').eq('id', businessId).maybeSingle();
  const ownerId = owner.data?.owner_id;
  if (ownerId) {
    const crm = await loadOwnerCrmServices(ownerId);
    if (crm && crm.length > 0) {
      const services = crm.map((row, index) => mapCrmService(row, businessId, index));
      await syncListedNames(service, businessId, services.map((row) => row.name));
      return { services, ready: true, source: 'crm' };
    }
  }

  let query = service
    .from('pro_booking_services')
    .select('id, business_id, name, description, category, price_cents, price_max_cents, price_type, unit, image_url, sort_order, is_active')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (isMissingServicesTable(error)) return { services: [], ready: false, source: 'booking' };
  if (error) throw error;
  return { services: (data ?? []).map((row) => mapCatalogService(row as ServiceRow)), ready: true, source: 'booking' };
}

function toRow(input: BookingServiceInput, sortOrder?: number) {
  return {
    name: input.name.slice(0, 80),
    description: input.description.slice(0, 200),
    category: input.category.slice(0, 80),
    price_cents: dollarsToCents(input.price),
    price_max_cents: input.priceType === 'range' && input.priceMax != null ? dollarsToCents(input.priceMax) : null,
    price_type: input.priceType,
    unit: input.unit,
    image_url: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
    is_active: input.isActive,
    ...(sortOrder != null ? { sort_order: sortOrder } : {}),
  };
}

async function syncServiceNames(client: ServiceClient, businessId: string): Promise<void> {
  const { data } = await client
    .from('pro_booking_services')
    .select('name')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  const services = (data ?? [])
    .map((row) => row.name.trim())
    .filter((name) => name.length > 0);
  await client.from('businesses').update({ services }).eq('id', businessId);
  invalidateBusinessDirectoryCache();
}

async function rememberCrmNames(client: ServiceClient, businessId: string, ownerId: string): Promise<void> {
  const crm = await loadOwnerCrmServices(ownerId);
  if (!crm) return;
  await syncListedNames(client, businessId, crm.map((service) => service.name));
}

export async function createCatalogService(
  businessId: string,
  input: BookingServiceInput
): Promise<CatalogService> {
  const client = createServiceRoleClient();
  const business = await resolveBusiness(businessId);
  if (business?.owner_id) {
    const crm = await loadOwnerCrmServices(business.owner_id);
    if (crm && crm.length > 0) {
      const imageUrl = input.imageUrl?.trim() ?? '';
      const created = await createService(client, business.owner_id, {
        ...toCrmWrite(input),
        images: imageUrl ? [{ image_url: imageUrl, is_thumbnail: true }] : [],
      });
      await rememberCrmNames(client, businessId, business.owner_id);
      return mapCrmService(created, businessId, crm.length);
    }
  }
  const { count } = await client
    .from('pro_booking_services')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);
  const { data, error } = await client
    .from('pro_booking_services')
    .insert({ business_id: businessId, ...toRow(input, count ?? 0) })
    .select('id, business_id, name, description, category, price_cents, price_max_cents, price_type, unit, image_url, sort_order, is_active')
    .single();
  if (error || !data) throw error ?? new Error('Failed to add service');
  await syncServiceNames(client, businessId);
  return mapCatalogService(data as ServiceRow);
}

export async function updateCatalogService(
  businessId: string,
  serviceId: string,
  input: BookingServiceInput
): Promise<CatalogService | null> {
  const client = createServiceRoleClient();
  const business = await resolveBusiness(businessId);
  if (business?.owner_id) {
    const crm = await loadOwnerCrmServices(business.owner_id);
    const existing = crm?.find((service) => service.id === serviceId);
    if (existing) {
      const images = nextCrmImages(input, existing);
      const { service, removedPaths } = await updateService(
        client,
        business.owner_id,
        serviceId,
        { ...toCrmWrite(input, existing), images: images.images },
        { replaceImages: images.replaceImages }
      );
      if (removedPaths.length > 0) await releaseStoragePaths(client, removedPaths);
      await rememberCrmNames(client, businessId, business.owner_id);
      const sortOrder = crm ? Math.max(crm.indexOf(existing), 0) : 0;
      return service ? mapCrmService(service, businessId, sortOrder) : null;
    }
  }
  const { data, error } = await client
    .from('pro_booking_services')
    .update(toRow(input))
    .eq('id', serviceId)
    .eq('business_id', businessId)
    .select('id, business_id, name, description, category, price_cents, price_max_cents, price_type, unit, image_url, sort_order, is_active')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await syncServiceNames(client, businessId);
  return mapCatalogService(data as ServiceRow);
}

export async function deleteCatalogService(businessId: string, serviceId: string): Promise<boolean> {
  const client = createServiceRoleClient();
  const business = await resolveBusiness(businessId);
  if (business?.owner_id) {
    const owned = await client
      .from('pro_crm_services')
      .select('id')
      .eq('id', serviceId)
      .eq('owner_id', business.owner_id)
      .maybeSingle();
    if (!owned.error && owned.data) {
      const removedPaths = await deleteService(client, business.owner_id, serviceId);
      if (removedPaths.length > 0) await releaseStoragePaths(client, removedPaths);
      await rememberCrmNames(client, businessId, business.owner_id);
      return true;
    }
    if (owned.error && !isMissingCatalogTable(owned.error)) throw owned.error;
  }
  const { data, error } = await client
    .from('pro_booking_services')
    .delete()
    .eq('id', serviceId)
    .eq('business_id', businessId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return false;
  await syncServiceNames(client, businessId);
  return true;
}

import { createServiceRoleClient } from '@/lib/supabase/server';
import { invalidateBusinessDirectoryCache } from '@/lib/data/businessDirectory';
import {
  dollarsToCents,
  type BookingServiceInput,
  type CatalogService,
  type ServicePriceType,
  type ServiceUnit,
} from '@/lib/booking/catalogService';

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
  return (data ?? []).some((row) => row.role === 'contractor' || row.role === 'realtor');
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

export async function listCatalogServices(
  businessId: string,
  includeInactive: boolean
): Promise<{ services: CatalogService[]; ready: boolean }> {
  const service = createServiceRoleClient();
  let query = service
    .from('pro_booking_services')
    .select('id, business_id, name, description, category, price_cents, price_max_cents, price_type, unit, image_url, sort_order, is_active')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (isMissingServicesTable(error)) return { services: [], ready: false };
  if (error) throw error;
  return { services: (data ?? []).map((row) => mapCatalogService(row as ServiceRow)), ready: true };
}

function toRow(input: BookingServiceInput, sortOrder?: number) {
  return {
    name: input.name,
    description: input.description,
    category: input.category,
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

export async function createCatalogService(
  businessId: string,
  input: BookingServiceInput
): Promise<CatalogService> {
  const client = createServiceRoleClient();
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

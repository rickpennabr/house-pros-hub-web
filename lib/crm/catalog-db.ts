import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import {
  builtinPriceMode,
  isBuiltinPriceType,
  isBuiltinUnit,
  type PriceMode,
} from '@/lib/crm/catalog-options';
import type { CatalogImageInput, ProductWriteInput, ServiceWriteInput } from '@/lib/schemas/crm-catalog';
import type { CatalogTermKind } from '@/lib/crm/catalog-options';
import type { ProCrmItem } from '@/components/invoices/AddProductServicePanel';
import type { CrmCatalogTerm, CrmImage, CrmProduct, CrmProductSpec, CrmService } from '@/lib/crm/catalog-types';

export type { CrmCatalogTerm, CrmImage, CrmProduct, CrmProductSpec, CrmService };

export const CRM_CATALOG_BUCKET = 'pro-crm-catalog';

type Db = SupabaseClient<Database>;

export class CatalogError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface ServiceRow {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  unit: string;
  price_type: string;
  price_mode: PriceMode;
  price_cents: number;
  price_min_cents: number | null;
  price_max_cents: number | null;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  brand: string;
  sku: string | null;
  upc: string | null;
  category: string | null;
  description: string | null;
  unit: string;
  price_cents: number;
  created_at: string;
}

interface ImageRow {
  id: string;
  service_id?: string;
  product_id?: string;
  image_url: string;
  storage_path: string | null;
  sort_order: number;
  is_thumbnail: boolean;
}

interface SpecRow {
  id: string;
  product_id: string;
  name: string;
  value: string;
  sort_order: number;
}

export function isMissingCatalogTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /pro_crm_services|pro_crm_products|pro_crm_catalog_terms/i.test(error.message ?? '');
}

export function catalogNotReadyMessage(): string {
  return 'Services and products are not ready yet. Apply supabase/migrations/101_crm_services_and_products.sql in the House Pros Hub database.';
}

function thumbnailUrl(images: CrmImage[]): string | null {
  return images.find((image) => image.is_thumbnail)?.image_url ?? images[0]?.image_url ?? null;
}

function imageUrlAllowed(imageUrl: string, existingUrls: Set<string>): boolean {
  if (existingUrls.has(imageUrl) || imageUrl.includes(`/${CRM_CATALOG_BUCKET}/`)) return true;
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeImages(images: CatalogImageInput[], ownerId: string, existingUrls: Set<string>): CatalogImageInput[] {
  const prepared = images.map((image) => {
    const imageUrl = image.image_url.trim();
    if (!imageUrlAllowed(imageUrl, existingUrls)) {
      throw new CatalogError('Upload photos with the photo button.');
    }
    let storagePath = image.storage_path?.trim() || null;
    if (storagePath && (storagePath.includes('..') || !storagePath.startsWith(`${ownerId}/`))) {
      storagePath = null;
    }
    return { image_url: imageUrl, storage_path: storagePath, is_thumbnail: image.is_thumbnail === true };
  });
  const thumbnailIndex = prepared.findIndex((image) => image.is_thumbnail);
  return prepared.map((image, index) => ({
    ...image,
    is_thumbnail: thumbnailIndex === -1 ? index === 0 : index === thumbnailIndex,
  }));
}

async function rememberTerm(
  supabase: Db,
  ownerId: string,
  kind: CatalogTermKind,
  label: string,
  priceMode?: PriceMode | null
): Promise<void> {
  const clean = label.trim();
  if (!clean) return;
  if (kind === 'unit' && isBuiltinUnit(clean)) return;
  if (kind === 'price_type' && isBuiltinPriceType(clean)) return;
  const { error } = await supabase.from('pro_crm_catalog_terms').insert({
    owner_id: ownerId,
    kind,
    label: clean,
    price_mode: kind === 'price_type' ? priceMode ?? null : null,
  });
  if (error && error.code !== '23505' && !isMissingCatalogTable(error)) {
    console.error('rememberTerm', error);
  }
}

function mapService(row: ServiceRow, images: CrmImage[]): CrmService {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    unit: row.unit,
    price_type: row.price_type,
    price_mode: row.price_mode,
    price_cents: row.price_cents,
    price_min_cents: row.price_min_cents,
    price_max_cents: row.price_max_cents,
    images,
    created_at: row.created_at,
  };
}

function mapProduct(row: ProductRow, images: CrmImage[], specs: CrmProductSpec[]): CrmProduct {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    sku: row.sku,
    upc: row.upc,
    category: row.category,
    description: row.description,
    unit: row.unit,
    price_cents: row.price_cents,
    images,
    specs,
    created_at: row.created_at,
  };
}

function groupImages(rows: ImageRow[], key: 'service_id' | 'product_id'): Map<string, CrmImage[]> {
  const grouped = new Map<string, CrmImage[]>();
  for (const row of rows) {
    const parentId = row[key];
    if (!parentId) continue;
    const list = grouped.get(parentId) ?? [];
    list.push({
      id: row.id,
      image_url: row.image_url,
      storage_path: row.storage_path,
      sort_order: row.sort_order,
      is_thumbnail: row.is_thumbnail,
    });
    grouped.set(parentId, list);
  }
  return grouped;
}

export async function listServices(supabase: Db, ownerId: string): Promise<CrmService[]> {
  const services = await supabase
    .from('pro_crm_services')
    .select('id, name, category, description, unit, price_type, price_mode, price_cents, price_min_cents, price_max_cents, created_at')
    .eq('owner_id', ownerId)
    .order('name', { ascending: true });
  if (services.error) throw services.error;
  const images = await supabase
    .from('pro_crm_service_images')
    .select('id, service_id, image_url, storage_path, sort_order, is_thumbnail')
    .eq('owner_id', ownerId)
    .order('sort_order', { ascending: true });
  if (images.error) throw images.error;
  const grouped = groupImages((images.data ?? []) as ImageRow[], 'service_id');
  return ((services.data ?? []) as ServiceRow[]).map((row) => mapService(row, grouped.get(row.id) ?? []));
}

export async function listProducts(supabase: Db, ownerId: string): Promise<CrmProduct[]> {
  const products = await supabase
    .from('pro_crm_products')
    .select('id, name, brand, sku, upc, category, description, unit, price_cents, created_at')
    .eq('owner_id', ownerId)
    .order('name', { ascending: true });
  if (products.error) throw products.error;
  const images = await supabase
    .from('pro_crm_product_images')
    .select('id, product_id, image_url, storage_path, sort_order, is_thumbnail')
    .eq('owner_id', ownerId)
    .order('sort_order', { ascending: true });
  if (images.error) throw images.error;
  const specs = await supabase
    .from('pro_crm_product_specs')
    .select('id, product_id, name, value, sort_order')
    .eq('owner_id', ownerId)
    .order('sort_order', { ascending: true });
  if (specs.error) throw specs.error;
  const groupedImages = groupImages((images.data ?? []) as ImageRow[], 'product_id');
  const groupedSpecs = new Map<string, CrmProductSpec[]>();
  for (const row of (specs.data ?? []) as SpecRow[]) {
    const list = groupedSpecs.get(row.product_id) ?? [];
    list.push({ id: row.id, name: row.name, value: row.value, sort_order: row.sort_order });
    groupedSpecs.set(row.product_id, list);
  }
  return ((products.data ?? []) as ProductRow[]).map((row) =>
    mapProduct(row, groupedImages.get(row.id) ?? [], groupedSpecs.get(row.id) ?? [])
  );
}

async function existingServiceImageUrls(supabase: Db, ownerId: string, serviceId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('pro_crm_service_images')
    .select('image_url')
    .eq('owner_id', ownerId)
    .eq('service_id', serviceId);
  return new Set((data ?? []).map((row) => row.image_url));
}

async function existingProductImageUrls(supabase: Db, ownerId: string, productId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('pro_crm_product_images')
    .select('image_url')
    .eq('owner_id', ownerId)
    .eq('product_id', productId);
  return new Set((data ?? []).map((row) => row.image_url));
}

async function writeServiceImages(
  supabase: Db,
  ownerId: string,
  serviceId: string,
  images: CatalogImageInput[]
): Promise<string[]> {
  const previous = await supabase
    .from('pro_crm_service_images')
    .select('id, storage_path')
    .eq('owner_id', ownerId)
    .eq('service_id', serviceId);
  if (previous.error) throw previous.error;
  const previousRows = previous.data ?? [];
  if (previousRows.length > 0) {
    const cleared = await supabase
      .from('pro_crm_service_images')
      .update({ is_thumbnail: false })
      .eq('owner_id', ownerId)
      .eq('service_id', serviceId);
    if (cleared.error) throw cleared.error;
  }
  if (images.length > 0) {
    const inserted = await supabase.from('pro_crm_service_images').insert(
      images.map((image, index) => ({
        service_id: serviceId,
        owner_id: ownerId,
        image_url: image.image_url,
        storage_path: image.storage_path ?? null,
        sort_order: index,
        is_thumbnail: image.is_thumbnail === true,
      }))
    );
    if (inserted.error) throw inserted.error;
  }
  if (previousRows.length > 0) {
    const deleted = await supabase
      .from('pro_crm_service_images')
      .delete()
      .in(
        'id',
        previousRows.map((row) => row.id)
      );
    if (deleted.error) throw deleted.error;
  }
  const kept = new Set(images.map((image) => image.storage_path).filter((path): path is string => Boolean(path)));
  return previousRows
    .map((row) => row.storage_path)
    .filter((path): path is string => typeof path === 'string' && path.length > 0 && !kept.has(path));
}

async function writeProductImages(
  supabase: Db,
  ownerId: string,
  productId: string,
  images: CatalogImageInput[]
): Promise<string[]> {
  const previous = await supabase
    .from('pro_crm_product_images')
    .select('id, storage_path')
    .eq('owner_id', ownerId)
    .eq('product_id', productId);
  if (previous.error) throw previous.error;
  const previousRows = previous.data ?? [];
  if (previousRows.length > 0) {
    const cleared = await supabase
      .from('pro_crm_product_images')
      .update({ is_thumbnail: false })
      .eq('owner_id', ownerId)
      .eq('product_id', productId);
    if (cleared.error) throw cleared.error;
  }
  if (images.length > 0) {
    const inserted = await supabase.from('pro_crm_product_images').insert(
      images.map((image, index) => ({
        product_id: productId,
        owner_id: ownerId,
        image_url: image.image_url,
        storage_path: image.storage_path ?? null,
        sort_order: index,
        is_thumbnail: image.is_thumbnail === true,
      }))
    );
    if (inserted.error) throw inserted.error;
  }
  if (previousRows.length > 0) {
    const deleted = await supabase
      .from('pro_crm_product_images')
      .delete()
      .in(
        'id',
        previousRows.map((row) => row.id)
      );
    if (deleted.error) throw deleted.error;
  }
  const kept = new Set(images.map((image) => image.storage_path).filter((path): path is string => Boolean(path)));
  return previousRows
    .map((row) => row.storage_path)
    .filter((path): path is string => typeof path === 'string' && path.length > 0 && !kept.has(path));
}

async function writeProductSpecs(supabase: Db, ownerId: string, productId: string, specs: ProductWriteInput['specs']): Promise<void> {
  const deleted = await supabase.from('pro_crm_product_specs').delete().eq('owner_id', ownerId).eq('product_id', productId);
  if (deleted.error) throw deleted.error;
  if (specs.length === 0) return;
  const inserted = await supabase.from('pro_crm_product_specs').insert(
    specs.map((spec, index) => ({
      product_id: productId,
      owner_id: ownerId,
      name: spec.name,
      value: spec.value,
      sort_order: index,
    }))
  );
  if (inserted.error) throw inserted.error;
}

export async function releaseStoragePaths(admin: Db, paths: string[]): Promise<void> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return;
  const stillUsed = new Set<string>();
  const serviceImages = await admin.from('pro_crm_service_images').select('storage_path').in('storage_path', unique);
  const productImages = await admin.from('pro_crm_product_images').select('storage_path').in('storage_path', unique);
  for (const row of serviceImages.data ?? []) {
    if (row.storage_path) stillUsed.add(row.storage_path);
  }
  for (const row of productImages.data ?? []) {
    if (row.storage_path) stillUsed.add(row.storage_path);
  }
  const removable = unique.filter((path) => !stillUsed.has(path));
  if (removable.length === 0) return;
  await admin.storage.from(CRM_CATALOG_BUCKET).remove(removable);
}

function servicePriceColumns(input: ServiceWriteInput) {
  if (input.price_mode === 'range') {
    const min = input.price_min_cents ?? 0;
    const max = input.price_max_cents ?? min;
    return { price_cents: min, price_min_cents: min, price_max_cents: max };
  }
  return { price_cents: input.price_cents, price_min_cents: null, price_max_cents: null };
}

async function rememberServiceVocabulary(supabase: Db, ownerId: string, input: ServiceWriteInput): Promise<void> {
  await rememberTerm(supabase, ownerId, 'service_category', input.category);
  await rememberTerm(supabase, ownerId, 'unit', input.unit);
  await rememberTerm(supabase, ownerId, 'price_type', input.price_type, input.price_mode);
}

async function rememberProductVocabulary(supabase: Db, ownerId: string, input: ProductWriteInput): Promise<void> {
  await rememberTerm(supabase, ownerId, 'product_category', input.category);
  await rememberTerm(supabase, ownerId, 'unit', input.unit);
  for (const spec of input.specs) {
    await rememberTerm(supabase, ownerId, 'spec_name', spec.name);
  }
}

export async function createService(supabase: Db, ownerId: string, input: ServiceWriteInput): Promise<CrmService> {
  const images = normalizeImages(input.images, ownerId, new Set());
  const inserted = await supabase
    .from('pro_crm_services')
    .insert({
      owner_id: ownerId,
      name: input.name,
      category: input.category || null,
      description: input.description || null,
      unit: input.unit,
      price_type: input.price_type,
      price_mode: input.price_mode,
      ...servicePriceColumns(input),
    })
    .select('id')
    .single();
  if (inserted.error || !inserted.data) throw inserted.error ?? new CatalogError('Failed to save the service', 500);
  try {
    await writeServiceImages(supabase, ownerId, inserted.data.id, images);
  } catch (error) {
    await supabase.from('pro_crm_services').delete().eq('id', inserted.data.id).eq('owner_id', ownerId);
    throw error;
  }
  await rememberServiceVocabulary(supabase, ownerId, input);
  const saved = (await listServices(supabase, ownerId)).find((service) => service.id === inserted.data.id);
  if (!saved) throw new CatalogError('Failed to load the saved service', 500);
  return saved;
}

export async function updateService(
  supabase: Db,
  ownerId: string,
  serviceId: string,
  input: ServiceWriteInput,
  options: { replaceImages: boolean }
): Promise<{ service: CrmService | null; removedPaths: string[] }> {
  const existingUrls = options.replaceImages ? await existingServiceImageUrls(supabase, ownerId, serviceId) : new Set<string>();
  const images = options.replaceImages ? normalizeImages(input.images, ownerId, existingUrls) : [];
  const updated = await supabase
    .from('pro_crm_services')
    .update({
      name: input.name,
      category: input.category || null,
      description: input.description || null,
      unit: input.unit,
      price_type: input.price_type,
      price_mode: input.price_mode,
      ...servicePriceColumns(input),
    })
    .eq('id', serviceId)
    .eq('owner_id', ownerId)
    .select('id');
  if (updated.error) throw updated.error;
  if (!updated.data?.length) return { service: null, removedPaths: [] };
  const removedPaths = options.replaceImages ? await writeServiceImages(supabase, ownerId, serviceId, images) : [];
  await rememberServiceVocabulary(supabase, ownerId, input);
  const service = (await listServices(supabase, ownerId)).find((row) => row.id === serviceId) ?? null;
  return { service, removedPaths };
}

export async function deleteService(supabase: Db, ownerId: string, serviceId: string): Promise<string[]> {
  const images = await supabase
    .from('pro_crm_service_images')
    .select('storage_path')
    .eq('owner_id', ownerId)
    .eq('service_id', serviceId);
  const paths = (images.data ?? []).map((row) => row.storage_path).filter((path): path is string => Boolean(path));
  const deleted = await supabase.from('pro_crm_services').delete().eq('id', serviceId).eq('owner_id', ownerId);
  if (deleted.error) throw deleted.error;
  return paths;
}

export async function createProduct(supabase: Db, ownerId: string, input: ProductWriteInput): Promise<CrmProduct> {
  const images = normalizeImages(input.images, ownerId, new Set());
  const inserted = await supabase
    .from('pro_crm_products')
    .insert({
      owner_id: ownerId,
      name: input.name,
      brand: input.brand,
      sku: input.sku || null,
      upc: input.upc || null,
      category: input.category || null,
      description: input.description || null,
      unit: input.unit,
      price_cents: input.price_cents,
    })
    .select('id')
    .single();
  if (inserted.error || !inserted.data) throw inserted.error ?? new CatalogError('Failed to save the product', 500);
  try {
    await writeProductImages(supabase, ownerId, inserted.data.id, images);
    await writeProductSpecs(supabase, ownerId, inserted.data.id, input.specs);
  } catch (error) {
    await supabase.from('pro_crm_products').delete().eq('id', inserted.data.id).eq('owner_id', ownerId);
    throw error;
  }
  await rememberProductVocabulary(supabase, ownerId, input);
  const saved = (await listProducts(supabase, ownerId)).find((product) => product.id === inserted.data.id);
  if (!saved) throw new CatalogError('Failed to load the saved product', 500);
  return saved;
}

export async function updateProduct(
  supabase: Db,
  ownerId: string,
  productId: string,
  input: ProductWriteInput,
  options: { replaceImages: boolean; replaceSpecs: boolean }
): Promise<{ product: CrmProduct | null; removedPaths: string[] }> {
  const existingUrls = options.replaceImages ? await existingProductImageUrls(supabase, ownerId, productId) : new Set<string>();
  const images = options.replaceImages ? normalizeImages(input.images, ownerId, existingUrls) : [];
  const updated = await supabase
    .from('pro_crm_products')
    .update({
      name: input.name,
      brand: input.brand,
      sku: input.sku || null,
      upc: input.upc || null,
      category: input.category || null,
      description: input.description || null,
      unit: input.unit,
      price_cents: input.price_cents,
    })
    .eq('id', productId)
    .eq('owner_id', ownerId)
    .select('id');
  if (updated.error) throw updated.error;
  if (!updated.data?.length) return { product: null, removedPaths: [] };
  const removedPaths = options.replaceImages ? await writeProductImages(supabase, ownerId, productId, images) : [];
  if (options.replaceSpecs) await writeProductSpecs(supabase, ownerId, productId, input.specs);
  await rememberProductVocabulary(supabase, ownerId, input);
  const product = (await listProducts(supabase, ownerId)).find((row) => row.id === productId) ?? null;
  return { product, removedPaths };
}

export async function deleteProduct(supabase: Db, ownerId: string, productId: string): Promise<string[]> {
  const images = await supabase
    .from('pro_crm_product_images')
    .select('storage_path')
    .eq('owner_id', ownerId)
    .eq('product_id', productId);
  const paths = (images.data ?? []).map((row) => row.storage_path).filter((path): path is string => Boolean(path));
  const deleted = await supabase.from('pro_crm_products').delete().eq('id', productId).eq('owner_id', ownerId);
  if (deleted.error) throw deleted.error;
  return paths;
}

export async function listCatalogTerms(supabase: Db, ownerId: string): Promise<CrmCatalogTerm[]> {
  const { data, error } = await supabase
    .from('pro_crm_catalog_terms')
    .select('id, kind, label, price_mode')
    .eq('owner_id', ownerId)
    .order('label', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CrmCatalogTerm[];
}

export async function createCatalogTerm(
  supabase: Db,
  ownerId: string,
  kind: CatalogTermKind,
  label: string,
  priceMode: PriceMode | null
): Promise<CrmCatalogTerm> {
  const inserted = await supabase
    .from('pro_crm_catalog_terms')
    .insert({
      owner_id: ownerId,
      kind,
      label,
      price_mode: kind === 'price_type' ? priceMode : null,
    })
    .select('id, kind, label, price_mode')
    .single();
  if (inserted.error?.code === '23505') {
    const existing = await supabase
      .from('pro_crm_catalog_terms')
      .select('id, kind, label, price_mode')
      .eq('owner_id', ownerId)
      .eq('kind', kind)
      .ilike('label', label)
      .maybeSingle();
    if (existing.data) return existing.data as CrmCatalogTerm;
  }
  if (inserted.error || !inserted.data) throw inserted.error ?? new CatalogError('Failed to save that name', 500);
  return inserted.data as CrmCatalogTerm;
}

export async function deleteCatalogTerm(supabase: Db, ownerId: string, termId: string): Promise<boolean> {
  const deleted = await supabase.from('pro_crm_catalog_terms').delete().eq('id', termId).eq('owner_id', ownerId).select('id');
  if (deleted.error) throw deleted.error;
  return (deleted.data ?? []).length > 0;
}

function serviceToItem(service: CrmService): ProCrmItem {
  const price =
    service.price_mode === 'range' ? service.price_min_cents ?? service.price_cents : service.price_cents;
  return {
    id: service.id,
    name: service.name,
    item_type: 'service',
    category: service.category,
    image_url: thumbnailUrl(service.images),
    description: service.description,
    price_cents: price,
    unit: service.unit,
  };
}

function productToItem(product: CrmProduct): ProCrmItem {
  return {
    id: product.id,
    name: product.name,
    item_type: 'product',
    sku: product.sku,
    category: product.category,
    image_url: thumbnailUrl(product.images),
    description: product.description,
    price_cents: product.price_cents,
    unit: product.unit,
  };
}

export async function listLegacyItems(supabase: Db, ownerId: string): Promise<ProCrmItem[]> {
  const [services, products] = await Promise.all([listServices(supabase, ownerId), listProducts(supabase, ownerId)]);
  return [...services.map(serviceToItem), ...products.map(productToItem)].sort((a, b) => a.name.localeCompare(b.name));
}

interface LegacyWrite {
  name: string;
  itemType: 'service' | 'product';
  sku: string;
  category: string;
  description: string;
  priceCents: number;
  unit: string;
}

export async function createLegacyItem(supabase: Db, ownerId: string, input: LegacyWrite): Promise<ProCrmItem> {
  if (input.itemType === 'product') {
    const product = await createProduct(supabase, ownerId, {
      name: input.name,
      brand: '',
      sku: input.sku,
      upc: '',
      category: input.category,
      description: input.description,
      unit: input.unit,
      price_cents: input.priceCents,
      images: [],
      specs: [],
    });
    return productToItem(product);
  }
  const mode = builtinPriceMode('Unit price') ?? 'unit';
  const service = await createService(supabase, ownerId, {
    name: input.name,
    category: input.category,
    description: input.description,
    unit: input.unit,
    price_type: 'Unit price',
    price_mode: mode,
    price_cents: input.priceCents,
    price_min_cents: null,
    price_max_cents: null,
    images: [],
  });
  return serviceToItem(service);
}

export async function updateLegacyItem(
  supabase: Db,
  ownerId: string,
  id: string,
  input: LegacyWrite
): Promise<ProCrmItem | null> {
  const services = await listServices(supabase, ownerId);
  const products = await listProducts(supabase, ownerId);
  const service = services.find((row) => row.id === id) ?? null;
  const product = products.find((row) => row.id === id) ?? null;
  if (!service && !product) return null;

  if (service && input.itemType === 'service') {
    const saved = (
      await updateService(
      supabase,
      ownerId,
      id,
      {
        name: input.name,
        category: input.category,
        description: input.description,
        unit: input.unit,
        price_type: service.price_type,
        price_mode: service.price_mode,
        price_cents: input.priceCents,
        price_min_cents: service.price_mode === 'range' ? input.priceCents : null,
        price_max_cents:
          service.price_mode === 'range' ? Math.max(service.price_max_cents ?? input.priceCents, input.priceCents) : null,
        images: service.images.map((image) => ({
          image_url: image.image_url,
          storage_path: image.storage_path,
          is_thumbnail: image.is_thumbnail,
        })),
      },
      { replaceImages: false }
      )
    ).service;
    return saved ? serviceToItem(saved) : null;
  }

  if (product && input.itemType === 'product') {
    const saved = (
      await updateProduct(
      supabase,
      ownerId,
      id,
      {
        name: input.name,
        brand: product.brand,
        sku: input.sku,
        upc: product.upc ?? '',
        category: input.category,
        description: input.description,
        unit: input.unit,
        price_cents: input.priceCents,
        images: [],
        specs: product.specs.map((spec) => ({ name: spec.name, value: spec.value })),
      },
      { replaceImages: false, replaceSpecs: false }
      )
    ).product;
    return saved ? productToItem(saved) : null;
  }

  const created = await createLegacyItem(supabase, ownerId, input);
  if (service) await deleteService(supabase, ownerId, id);
  if (product) await deleteProduct(supabase, ownerId, id);
  return created;
}

export async function deleteLegacyItem(supabase: Db, ownerId: string, id: string): Promise<string[]> {
  const servicePaths = await deleteService(supabase, ownerId, id);
  const productPaths = await deleteProduct(supabase, ownerId, id);
  return [...servicePaths, ...productPaths];
}

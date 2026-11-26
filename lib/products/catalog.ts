import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductVariant, ProProduct } from '@/lib/products/types';

/** Full product payload for detail pages and admin. */
export const CATALOG_SELECT = `
  base_product_id,
  product_name,
  product_type,
  product_note,
  image_url,
  specs:product_specs(spec_name, spec_value, sort_order),
  created_at,
  updated_at,
  brand:brands(brand_name, logo_url),
  variants:product_variants(
    variant_id,
    size,
    sqft_pallet,
    sqft_layer,
    lnft_pallet,
    layer_pallet,
    pcs_pallet,
    color:colors(color_name),
    thickness:thicknesses(thickness_mm, thickness_in),
    images:product_images(image_path)
  )
`;

/** Card/grid payload: no specs or variant images (use product.image_url). */
export const CATALOG_LIST_SELECT = `
  base_product_id,
  product_name,
  product_type,
  product_note,
  image_url,
  created_at,
  updated_at,
  brand:brands(brand_name, logo_url),
  variants:product_variants(
    variant_id,
    size,
    sqft_pallet,
    sqft_layer,
    color:colors(color_name),
    thickness:thicknesses(thickness_mm, thickness_in)
  )
`;

interface NamedRow {
  brand_name?: string;
  logo_url?: string | null;
  color_name?: string;
  thickness_mm?: string;
  thickness_in?: string;
}

interface SpecRow {
  spec_name?: string | null;
  spec_value?: string | null;
  sort_order?: number | null;
}

interface ImageRow {
  image_path?: string | null;
}

interface VariantRow {
  variant_id: number;
  size?: string | null;
  sqft_pallet?: number | null;
  sqft_layer?: number | null;
  lnft_pallet?: number | null;
  layer_pallet?: number | null;
  pcs_pallet?: number | null;
  color?: NamedRow | NamedRow[] | null;
  thickness?: NamedRow | NamedRow[] | null;
  images?: ImageRow[] | null;
}

export interface CatalogProductRow {
  base_product_id: number;
  product_name: string;
  product_type?: string | null;
  product_note?: string | null;
  image_url?: string | null;
  specs?: SpecRow[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  brand?: NamedRow | NamedRow[] | null;
  variants?: VariantRow[] | null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function cleanPath(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function mapCatalogProduct(row: CatalogProductRow): ProProduct {
  const variants: ProductVariant[] = (row.variants ?? [])
    .slice()
    .sort((a, b) => a.variant_id - b.variant_id)
    .map((variant) => {
      const color = one(variant.color);
      const thickness = one(variant.thickness);
      return {
        id: variant.variant_id,
        color: color?.color_name ?? '',
        size: variant.size ?? '',
        thicknessMm: thickness?.thickness_mm ?? '',
        thicknessIn: thickness?.thickness_in ?? '',
        sqftPallet: variant.sqft_pallet ?? 0,
        sqftLayer: variant.sqft_layer ?? 0,
        lnftPallet: variant.lnft_pallet ?? 0,
        layerPallet: variant.layer_pallet ?? 0,
        pcsPallet: variant.pcs_pallet ?? 0,
        images: (variant.images ?? []).map((image) => cleanPath(image.image_path)).filter(Boolean),
      };
    });

  const images = Array.from(
    new Set([...variants.flatMap((variant) => variant.images), cleanPath(row.image_url)].filter(Boolean))
  );

  return {
    id: String(row.base_product_id),
    name: row.product_name,
    slug: String(row.base_product_id),
    brand: one(row.brand)?.brand_name ?? '',
    brand_logo: one(row.brand)?.logo_url ?? null,
    product_type: row.product_type ?? '',
    description: row.product_note ?? '',
    image_url: images[0] ?? null,
    images,
    specs: (row.specs ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((spec) => ({ name: (spec.spec_name ?? '').trim(), value: (spec.spec_value ?? '').trim() }))
      .filter((spec) => spec.name && spec.value),
    variants,
    published: true,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

const SPECS_EMBED = 'specs:product_specs(spec_name, spec_value, sort_order),';

async function runCatalogQuery<T>(
  run: (select: string) => PromiseLike<{ data: T; error: { message?: string } | null }>,
  select = CATALOG_SELECT
): Promise<{ data: T; error: { message?: string } | null }> {
  let query = select;
  let result = await run(query);
  // Before migration 179 the brand has no logo column: ask again without it.
  if (result.error && /logo_url/i.test(result.error.message ?? '')) {
    query = query.split('brand:brands(brand_name, logo_url)').join('brand:brands(brand_name)');
    result = await run(query);
  }
  if (query.includes(SPECS_EMBED) && result.error && /product_specs/i.test(result.error.message ?? '')) {
    return run(query.replace(SPECS_EMBED, ''));
  }
  return result;
}

/** Full catalog rows (admin / detail-adjacent). Includes specs and variant images. */
export async function listCatalogProducts(service: SupabaseClient): Promise<ProProduct[]> {
  const result = await runCatalogQuery((select) =>
    service.from('base_products').select(select).order('product_name')
  );
  if (result.error) throw result.error;
  return ((result.data ?? []) as unknown as CatalogProductRow[]).map(mapCatalogProduct);
}

/** Public grid cards — no specs or variant images. */
export async function listCatalogProductCards(service: SupabaseClient): Promise<ProProduct[]> {
  const result = await runCatalogQuery(
    (select) => service.from('base_products').select(select).order('product_name'),
    CATALOG_LIST_SELECT
  );
  if (result.error) throw result.error;
  return ((result.data ?? []) as unknown as CatalogProductRow[]).map(mapCatalogProduct);
}

export async function getCatalogProduct(service: SupabaseClient, id: number): Promise<ProProduct | null> {
  const result = await runCatalogQuery((select) =>
    service.from('base_products').select(select).eq('base_product_id', id).maybeSingle()
  );
  if (result.error) throw result.error;
  if (!result.data) return null;
  return mapCatalogProduct(result.data as unknown as CatalogProductRow);
}

export async function getCatalogProductByName(
  service: SupabaseClient,
  name: string
): Promise<ProProduct | null> {
  const needle = name.trim();
  if (!needle) return null;
  const result = await runCatalogQuery((select) =>
    service.from('base_products').select(select).ilike('product_name', needle).limit(1).maybeSingle()
  );
  if (result.error) throw result.error;
  if (!result.data) return null;
  return mapCatalogProduct(result.data as unknown as CatalogProductRow);
}

export async function replaceCatalogSpecs(
  service: SupabaseClient,
  productId: number,
  specs: { name: string; value: string }[]
): Promise<void> {
  const deleted = await service.from('product_specs').delete().eq('base_product_id', productId);
  if (deleted.error) throw deleted.error;
  if (specs.length === 0) return;
  const inserted = await service.from('product_specs').insert(
    specs.map((spec, index) => ({
      base_product_id: productId,
      spec_name: spec.name,
      spec_value: spec.value,
      sort_order: index,
    }))
  );
  if (inserted.error) throw inserted.error;
}

export async function resolveBrandId(service: SupabaseClient, name: string, logoUrl?: string): Promise<number | null> {
  const brandName = name.trim();
  if (!brandName) return null;
  const logo = logoUrl?.trim() ?? '';
  const existing = await service.from('brands').select('brand_id').eq('brand_name', brandName).maybeSingle();
  if (existing.error) throw existing.error;
  let brandId = existing.data?.brand_id as number | undefined;
  if (!brandId) {
    const inserted = await service.from('brands').insert({ brand_name: brandName }).select('brand_id').single();
    if (inserted.error || !inserted.data) throw inserted.error ?? new Error('Failed to save brand');
    brandId = inserted.data.brand_id as number;
  }
  if (logo) {
    const saved = await service.from('brands').update({ logo_url: logo }).eq('brand_id', brandId);
    if (saved.error && !/logo_url/i.test(saved.error.message ?? '')) throw saved.error;
  }
  return brandId;
}

export async function resolveColorId(service: SupabaseClient, name: string): Promise<number | null> {
  const colorName = name.trim();
  if (!colorName) return null;
  const existing = await service.from('colors').select('color_id').eq('color_name', colorName).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.color_id) return existing.data.color_id as number;
  const inserted = await service.from('colors').insert({ color_name: colorName }).select('color_id').single();
  if (inserted.error || !inserted.data) throw inserted.error ?? new Error('Failed to save color');
  return inserted.data.color_id as number;
}

export async function resolveThicknessId(
  service: SupabaseClient,
  thicknessMm: string,
  thicknessIn: string
): Promise<number | null> {
  const mm = thicknessMm.trim();
  const inches = thicknessIn.trim();
  if (!mm && !inches) return null;
  const existing = await service
    .from('thicknesses')
    .select('thickness_id')
    .eq('thickness_mm', mm)
    .eq('thickness_in', inches)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.thickness_id) return existing.data.thickness_id as number;
  const inserted = await service
    .from('thicknesses')
    .insert({ thickness_mm: mm, thickness_in: inches })
    .select('thickness_id')
    .single();
  if (inserted.error || !inserted.data) throw inserted.error ?? new Error('Failed to save thickness');
  return inserted.data.thickness_id as number;
}

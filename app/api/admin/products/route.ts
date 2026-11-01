import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCatalogProduct, listCatalogProducts, resolveBrandId } from '@/lib/products/catalog';
import { proProductWriteSchema } from '@/lib/schemas/pro-products';
import { isMissingProductsStorage, productsStorageError, requireProductsAdmin } from '@/lib/products/admin';

/**
 * GET /api/admin/products
 * List the House Pros catalog, including every variation. Admin only.
 */
export async function GET() {
  const { error: authError } = await requireProductsAdmin();
  if (authError) return authError;

  try {
    const products = await listCatalogProducts(createServiceRoleClient());
    return NextResponse.json({ products });
  } catch (error) {
    console.error('GET /api/admin/products', error);
    const known = error as { code?: string; message?: string };
    if (isMissingProductsStorage(known)) return productsStorageError();
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}

/**
 * POST /api/admin/products
 * Create a catalog product. Variations are added after the product exists. Admin only.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireProductsAdmin();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = proProductWriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid product' }, { status: 400 });
  }

  const service = createServiceRoleClient();
  try {
    const brandId = await resolveBrandId(service, parsed.data.brand);
    const inserted = await service
      .from('base_products')
      .insert({
        brand_id: brandId,
        product_name: parsed.data.name,
        product_type: parsed.data.product_type,
        product_note: parsed.data.description,
        image_url: parsed.data.image_url ?? '',
      })
      .select('base_product_id')
      .single();

    if (inserted.error || !inserted.data) {
      if (isMissingProductsStorage(inserted.error)) return productsStorageError();
      return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }

    const product = await getCatalogProduct(service, inserted.data.base_product_id as number);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/products', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

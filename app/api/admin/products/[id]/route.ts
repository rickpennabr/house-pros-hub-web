import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCatalogProduct, replaceCatalogSpecs, resolveBrandId } from '@/lib/products/catalog';
import { proProductWriteSchema } from '@/lib/schemas/pro-products';
import { isMissingProductsStorage, productsStorageError, requireProductsAdmin } from '@/lib/products/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function productId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

/**
 * PATCH /api/admin/products/[id]
 * Update a catalog product. Variations stay attached. Admin only.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error: authError } = await requireProductsAdmin();
  if (authError) return authError;

  const id = productId((await context.params).id);
  if (id == null) return NextResponse.json({ error: 'Product ID required' }, { status: 400 });

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
    const updated = await service
      .from('base_products')
      .update({
        brand_id: brandId,
        product_name: parsed.data.name,
        product_type: parsed.data.product_type,
        product_note: parsed.data.description,
        image_url: parsed.data.image_url ?? '',
      })
      .eq('base_product_id', id)
      .select('base_product_id');

    if (updated.error) {
      if (isMissingProductsStorage(updated.error)) return productsStorageError();
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }
    if (!updated.data?.length) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    await replaceCatalogSpecs(service, id, parsed.data.specs);
    const product = await getCatalogProduct(service, id);
    return NextResponse.json({ product });
  } catch (error) {
    console.error('PATCH /api/admin/products', error);
    const message = error instanceof Error ? error.message : (error as { message?: string })?.message ?? '';
    if (/product_specs/i.test(message)) {
      return NextResponse.json(
        { error: 'Specifications are not ready. Apply supabase/migrations/102_product_specs.sql.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/products/[id]
 * Remove a catalog product and its variations. Admin only.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { error: authError } = await requireProductsAdmin();
  if (authError) return authError;

  const id = productId((await context.params).id);
  if (id == null) return NextResponse.json({ error: 'Product ID required' }, { status: 400 });

  const service = createServiceRoleClient();
  const { error } = await service.from('base_products').delete().eq('base_product_id', id);
  if (error) {
    console.error('DELETE /api/admin/products', error);
    if (isMissingProductsStorage(error)) return productsStorageError();
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

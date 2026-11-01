import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCatalogProduct, resolveColorId, resolveThicknessId } from '@/lib/products/catalog';
import { productVariantWriteSchema } from '@/lib/schemas/pro-products';
import { isMissingProductsStorage, productsStorageError, requireProductsAdmin } from '@/lib/products/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/products/[id]/variants
 * Add a color, size, and thickness variation to a catalog product. Admin only.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { error: authError } = await requireProductsAdmin();
  if (authError) return authError;

  const rawId = (await context.params).id;
  if (!/^\d+$/.test(rawId)) return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
  const productId = Number(rawId);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = productVariantWriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid variation' }, { status: 400 });
  }

  const service = createServiceRoleClient();
  try {
    const product = await getCatalogProduct(service, productId);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const colorId = await resolveColorId(service, parsed.data.color);
    const thicknessId = await resolveThicknessId(service, parsed.data.thickness_mm, parsed.data.thickness_in);
    const inserted = await service.from('product_variants').insert({
      base_product_id: productId,
      color_id: colorId,
      thickness_id: thicknessId,
      product_name: product.name,
      size: parsed.data.size,
      sqft_pallet: parsed.data.sqft_pallet,
      sqft_layer: parsed.data.sqft_layer,
      lnft_pallet: parsed.data.lnft_pallet,
      layer_pallet: parsed.data.layer_pallet,
      pcs_pallet: parsed.data.pcs_pallet,
    });

    if (inserted.error) {
      if (isMissingProductsStorage(inserted.error)) return productsStorageError();
      if (inserted.error.code === '23505') {
        return NextResponse.json({ error: 'That variation already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to add variation' }, { status: 500 });
    }

    const updated = await getCatalogProduct(service, productId);
    return NextResponse.json({ product: updated }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/products/[id]/variants', error);
    return NextResponse.json({ error: 'Failed to add variation' }, { status: 500 });
  }
}

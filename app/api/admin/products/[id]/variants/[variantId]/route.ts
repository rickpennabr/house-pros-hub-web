import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCatalogProduct } from '@/lib/products/catalog';
import { requireProductsAdmin } from '@/lib/products/admin';

interface RouteContext {
  params: Promise<{ id: string; variantId: string }>;
}

/**
 * DELETE /api/admin/products/[id]/variants/[variantId]
 * Remove one variation and its photos. Admin only.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { error: authError } = await requireProductsAdmin();
  if (authError) return authError;

  const { id, variantId } = await context.params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(variantId)) {
    return NextResponse.json({ error: 'Variation ID required' }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { error } = await service
    .from('product_variants')
    .delete()
    .eq('variant_id', Number(variantId))
    .eq('base_product_id', Number(id));

  if (error) {
    console.error('DELETE /api/admin/products/[id]/variants', error);
    return NextResponse.json({ error: 'Failed to delete variation' }, { status: 500 });
  }

  const product = await getCatalogProduct(service, Number(id));
  return NextResponse.json({ product });
}

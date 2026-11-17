import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { catalogErrorResponse } from '@/lib/crm/catalog-http';
import { deleteProduct, releaseStoragePaths, setProductShowOnProfile, updateProduct } from '@/lib/crm/catalog-db';
import { productProfileVisibilitySchema, productWriteSchema } from '@/lib/schemas/crm-catalog';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/crm/products/[id]
 * Update a product, or only its show-on-profile toggle for the details page.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    const visibilityOnly = productProfileVisibilitySchema.safeParse(body);
    if (
      visibilityOnly.success &&
      body &&
      typeof body === 'object' &&
      Object.keys(body as object).length === 1 &&
      'show_on_profile' in (body as object)
    ) {
      const product = await setProductShowOnProfile(supabase, user.id, id, visibilityOnly.data.show_on_profile);
      if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      return NextResponse.json({ product });
    }

    const parsed = productWriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid product' }, { status: 400 });
    }
    const { product, removedPaths } = await updateProduct(supabase, user.id, id, parsed.data, {
      replaceImages: true,
      replaceSpecs: true,
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    await releaseStoragePaths(createServiceRoleClient(), removedPaths);
    return NextResponse.json({ product });
  } catch (error) {
    return catalogErrorResponse(error, 'PATCH /api/crm/products/[id]');
  }
}

/**
 * DELETE /api/crm/products/[id]
 * Delete a product, its photos, and its specifications.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await context.params;
    const removedPaths = await deleteProduct(supabase, user.id, id);
    await releaseStoragePaths(createServiceRoleClient(), removedPaths);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return catalogErrorResponse(error, 'DELETE /api/crm/products/[id]');
  }
}

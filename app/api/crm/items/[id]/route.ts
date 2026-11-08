import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { catalogErrorResponse } from '@/lib/crm/catalog-http';
import { deleteLegacyItem, releaseStoragePaths, updateLegacyItem } from '@/lib/crm/catalog-db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function legacyBody(body: Record<string, unknown>) {
  const trim = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const name = trim(body.name);
  const itemType = body.item_type === 'product' || body.itemType === 'product' ? 'product' : 'service';
  const priceCents =
    typeof body.price_cents === 'number'
      ? Math.max(0, Math.round(body.price_cents))
      : typeof body.priceCents === 'number'
        ? Math.max(0, Math.round(body.priceCents))
        : 0;
  return {
    name,
    itemType: itemType as 'service' | 'product',
    sku: trim(body.sku),
    category: trim(body.category),
    description: trim(body.description),
    priceCents,
    unit: trim(body.unit) || 'each',
  };
}

/**
 * PATCH /api/crm/items/[id]
 * Update a service or product from an estimate line-item editor.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await context.params;
    const input = legacyBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (!input.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const item = await updateLegacyItem(supabase, user.id, id, input);
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    return catalogErrorResponse(error, 'PATCH /api/crm/items/[id]');
  }
}

/**
 * DELETE /api/crm/items/[id]
 * Delete a service or product from the combined estimate list.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await context.params;
    const removedPaths = await deleteLegacyItem(supabase, user.id, id);
    await releaseStoragePaths(createServiceRoleClient(), removedPaths);
    return NextResponse.json({ success: true });
  } catch (error) {
    return catalogErrorResponse(error, 'DELETE /api/crm/items/[id]');
  }
}

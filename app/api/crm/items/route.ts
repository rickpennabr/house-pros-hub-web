import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { catalogErrorResponse } from '@/lib/crm/catalog-http';
import { createLegacyItem, listLegacyItems } from '@/lib/crm/catalog-db';

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
 * GET /api/crm/items
 * Combined services and products for estimate and invoice line items.
 */
export async function GET() {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const items = await listLegacyItems(supabase, user.id);
    return NextResponse.json({ items });
  } catch (error) {
    return catalogErrorResponse(error, 'GET /api/crm/items');
  }
}

/**
 * POST /api/crm/items
 * Quick-add from an estimate or invoice. Services and products are stored in their own tables.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const input = legacyBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (!input.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const item = await createLegacyItem(supabase, user.id, input);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return catalogErrorResponse(error, 'POST /api/crm/items');
  }
}

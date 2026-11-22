import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createProduct } from '@/lib/crm/catalog-db';
import { catalogSpecs, type TradeCatalogItem } from '@/lib/protrades/server';

const bodySchema = z.object({
  itemId: z.string().uuid(),
  /** The pro's own price, in cents. */
  priceCents: z.number().int().min(0).max(100_000_000).optional(),
  /** The module it was added from (a shared rock added in Landscape is tagged Landscape). */
  trade: z.string().max(30).optional(),
});

/**
 * POST /api/crm/protrades/catalog/add { itemId, priceCents? }
 * Copy a hub catalog item (a plant, a paver) into the pro's products so it can go on estimates.
 */
export async function POST(request: NextRequest) {
  const { error, user, supabase } = await requireContractor();
  if (error) return error;
  if (!user || !supabase) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { data: row } = await createServiceRoleClient()
    .from('trade_catalog_items')
    .select('*')
    .eq('id', parsed.data.itemId)
    .eq('is_active', true)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  const item = row as TradeCatalogItem;
  const shared = Array.isArray(item.also_trades) ? item.also_trades : [];
  const tagTrade = parsed.data.trade && shared.includes(parsed.data.trade) ? parsed.data.trade : item.trade;

  const { data: existing } = await supabase
    .from('pro_crm_products')
    .select('id')
    .eq('owner_id', user.id)
    .eq('catalog_item_id', item.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ productId: existing.id, alreadyAdded: true });

  try {
    const specs = catalogSpecs(item);
    if (item.scientific_name) specs.unshift({ name: 'Scientific name', value: item.scientific_name.slice(0, 200) });
    const product = await createProduct(supabase, user.id, {
      name: item.name,
      brand: item.brand,
      sku: '',
      upc: '',
      category: item.category ?? '',
      description: item.description ?? '',
      unit: item.unit,
      price_cents: parsed.data.priceCents ?? item.typical_price_cents ?? 0,
      show_on_profile: false,
      images: item.image_url ? [{ image_url: item.image_url, storage_path: null, is_thumbnail: true }] : [],
      specs: specs.slice(0, 40),
    });
    await supabase
      .from('pro_crm_products')
      .update({ trade: tagTrade, catalog_item_id: item.id })
      .eq('id', product.id)
      .eq('owner_id', user.id);
    return NextResponse.json({ productId: product.id });
  } catch (err) {
    console.error('POST /api/crm/protrades/catalog/add', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not add the item' }, { status: 500 });
  }
}

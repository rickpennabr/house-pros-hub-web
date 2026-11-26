import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { activeTrades, ProTradesError, searchCatalog, tradesOwnerFor } from '@/lib/protrades/server';
import { isTradeSlug } from '@/lib/protrades/trades';

/**
 * GET /api/crm/protrades/catalog?trade=&kind=&category=&q=&page=
 * mine=1 also returns the pro's own CRM products that match q (not linked to a catalog item).
 * Browse a trade's hub database (plants, pavers, base materials). Marks items already in the pro's products.
 */
export async function GET(request: NextRequest) {
  const { error, user, supabase } = await requireContractor();
  if (error) return error;
  if (!user || !supabase) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const trade = params.get('trade');
  if (!isTradeSlug(trade)) return NextResponse.json({ error: 'Unknown trade' }, { status: 400 });
  try {
    // The Hub database (with prices) is part of ProTrades: the pro's account must have this trade turned on.
    const service = createServiceRoleClient();
    const { ownerId } = await tradesOwnerFor(user.id, service);
    if (!(await activeTrades(ownerId, service)).includes(trade)) {
      return NextResponse.json({ error: 'Turn on this trade in ProTrades to use the Hub database' }, { status: 403 });
    }
    const result = await searchCatalog(
      {
        trade,
        kind: params.get('kind') || undefined,
      collection: params.get('collection') || undefined,
        category: params.get('category') || undefined,
        q: params.get('q') || undefined,
        page: Number(params.get('page') || 1),
      },
      createServiceRoleClient()
    );
    const ids = result.items.map((item) => item.id);
    const { data: owned } = ids.length
      ? await supabase.from('pro_crm_products').select('catalog_item_id').eq('owner_id', user.id).in('catalog_item_id', ids)
      : { data: [] };
    const added = new Set((owned ?? []).map((row) => row.catalog_item_id).filter(Boolean));
    const mine = params.get('mine') === '1' ? await searchOwnProducts(supabase, user.id, params.get('q')) : undefined;
    return NextResponse.json({ ...result, items: result.items.map((item) => ({ ...item, added: added.has(item.id) })), mine });
  } catch (err) {
    if (err instanceof ProTradesError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load the catalog' }, { status: 500 });
  }
}

type Db = NonNullable<Awaited<ReturnType<typeof requireContractor>>['supabase']>;

/** The pro's own products that match the search and are not already a catalog item. */
async function searchOwnProducts(supabase: Db, ownerId: string, raw: string | null) {
  const q = raw?.trim().replace(/[%,()]/g, ' ').slice(0, 80);
  if (!q || q.length < 2) return [];
  const { data, error } = await supabase
    .from('pro_crm_products')
    .select('id, name, brand, category, unit, price_cents, catalog_item_id')
    .eq('owner_id', ownerId)
    .is('catalog_item_id', null)
    .or(`name.ilike.%${q}%,brand.ilike.%${q}%,category.ilike.%${q}%`)
    .order('name', { ascending: true })
    .limit(12);
  if (error || !data?.length) return [];
  const { data: images } = await supabase
    .from('pro_crm_product_images')
    .select('product_id, image_url, is_thumbnail, sort_order')
    .in('product_id', data.map((row) => row.id))
    .order('is_thumbnail', { ascending: false })
    .order('sort_order', { ascending: true });
  const photo = new Map<string, string>();
  for (const image of images ?? []) if (!photo.has(image.product_id)) photo.set(image.product_id, image.image_url);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand ?? '',
    kind: 'mine',
    category: row.category,
    unit: row.unit || 'each',
    typical_price_cents: row.price_cents || null,
    image_url: photo.get(row.id) ?? null,
    specs: [],
    source: 'mine' as const,
  }));
}

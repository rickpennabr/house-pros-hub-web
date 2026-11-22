import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ProTradesError, searchCatalog } from '@/lib/protrades/server';
import { isTradeSlug } from '@/lib/protrades/trades';

/**
 * GET /api/crm/protrades/catalog?trade=&kind=&category=&q=&page=
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
    const result = await searchCatalog(
      {
        trade,
        kind: params.get('kind') || undefined,
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
    return NextResponse.json({ ...result, items: result.items.map((item) => ({ ...item, added: added.has(item.id) })) });
  } catch (err) {
    if (err instanceof ProTradesError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load the catalog' }, { status: 500 });
  }
}

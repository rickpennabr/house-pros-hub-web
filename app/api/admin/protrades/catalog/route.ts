import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/blog/admin';
import { ProTradesError, searchCatalog } from '@/lib/protrades/server';
import { TRADE_SLUGS, isTradeSlug } from '@/lib/protrades/trades';

/** GET /api/admin/protrades/catalog?trade=&kind=&q=&page= : every item, hidden ones too. Admin only. */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const trade = params.get('trade');
  if (!isTradeSlug(trade)) return NextResponse.json({ error: 'Unknown trade' }, { status: 400 });
  try {
    const result = await searchCatalog({
      trade,
      kind: params.get('kind') || undefined,
      q: params.get('q') || undefined,
      page: Number(params.get('page') || 1),
      pageSize: 100,
      includeInactive: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProTradesError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load' }, { status: 500 });
  }
}

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  trade: z.enum(TRADE_SLUGS),
  kind: z.string().regex(/^[a-z0-9_]{2,30}$/),
  name: z.string().trim().min(1).max(160),
  brand: z.string().trim().max(120).default(''),
  scientific_name: z.string().trim().max(160).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  image_url: z.string().trim().url().max(1000).nullable().optional(),
  unit: z.string().trim().min(1).max(40),
  typical_price_cents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  specs: z.array(z.object({ name: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(200) })).max(40).default([]),
  region: z.string().trim().min(1).max(40).default('las-vegas'),
  /** Other trades this item also shows in. */
  also_trades: z.array(z.enum(TRADE_SLUGS)).max(4).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(100000).default(0),
});

/** POST /api/admin/protrades/catalog: create or update an item. Admin only. */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const parsed = itemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid item' }, { status: 400 });
  const { id, ...fields } = parsed.data;
  const clean = {
    ...fields,
    scientific_name: fields.scientific_name || null,
    category: fields.category || null,
    description: fields.description || null,
    image_url: fields.image_url || null,
    typical_price_cents: fields.typical_price_cents ?? null,
    also_trades: fields.also_trades.filter((slug) => slug !== fields.trade),
  };
  const service = createServiceRoleClient();
  const result = id
    ? await service.from('trade_catalog_items').update(clean).eq('id', id).select('*').single()
    : await service.from('trade_catalog_items').insert(clean).select('*').single();
  if (result.error) {
    const duplicate = result.error.code === '23505';
    return NextResponse.json(
      { error: duplicate ? 'An item with this brand and name already exists.' : result.error.message },
      { status: duplicate ? 409 : 500 }
    );
  }
  return NextResponse.json({ item: result.data });
}

/** DELETE /api/admin/protrades/catalog?id= : remove an item (pros keep their copies). Admin only. */
export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
  const { error: deleteError } = await createServiceRoleClient().from('trade_catalog_items').delete().eq('id', id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

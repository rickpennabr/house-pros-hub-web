import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/blog/admin';
import { listProducts } from '@/lib/crm/catalog-db';
import { guessHardscapeKind } from '@/lib/protrades/trades';

const bodySchema = z.object({
  /** Hide the seeded starter items so the database is only the imported products. */
  hideStarter: z.boolean().default(true),
});

const STARTER_MARK = '%Starter list:%';

/**
 * POST /api/admin/protrades/import-products
 * Copies every product in the admin's own CRM into the Hardscape database.
 * Re-running updates items already imported (matched by brand + name) instead of duplicating them,
 * and tags the admin's products as hardscape, linked to their database item.
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAdmin();
  if (error || !user) return error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const service = createServiceRoleClient();
  let products;
  try {
    products = await listProducts(service, user.id);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not read your products' }, { status: 500 });
  }
  if (products.length === 0) return NextResponse.json({ error: 'There are no products in your CRM to import.' }, { status: 400 });

  const existing = await service.from('trade_catalog_items').select('id, brand, name').eq('trade', 'hardscape');
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  const key = (brand: string, name: string) => `${brand.trim().toLowerCase()}|${name.trim().toLowerCase()}`;
  const byKey = new Map((existing.data ?? []).map((row) => [key(row.brand ?? '', row.name), row.id as string]));

  let created = 0;
  let updated = 0;
  const failed: string[] = [];
  const importedIds: string[] = [];
  for (const [index, product] of products.entries()) {
    const photo = product.images.find((image) => image.is_thumbnail) ?? product.images[0];
    const fields = {
      trade: 'hardscape',
      kind: guessHardscapeKind(`${product.category ?? ''} ${product.name} ${product.brand}`),
      name: product.name.slice(0, 160),
      brand: (product.brand ?? '').slice(0, 120),
      category: product.category?.slice(0, 80) || null,
      description: product.description?.slice(0, 4000) || null,
      image_url: photo?.image_url ?? null,
      unit: product.unit || 'each',
      typical_price_cents: product.price_cents > 0 ? product.price_cents : null,
      specs: product.specs.map((spec) => ({ name: spec.name, value: spec.value })),
      is_active: true,
      sort_order: index,
    };
    const existingId = byKey.get(key(fields.brand, fields.name));
    const result = existingId
      ? await service.from('trade_catalog_items').update(fields).eq('id', existingId).select('id').single()
      : await service.from('trade_catalog_items').insert(fields).select('id').single();
    if (result.error || !result.data) {
      failed.push(product.name);
      continue;
    }
    const itemId = result.data.id as string;
    importedIds.push(itemId);
    byKey.set(key(fields.brand, fields.name), itemId);
    if (existingId) updated += 1;
    else created += 1;
    // Tag the admin's own product so it shows as Hardscape and "In my products".
    await service.from('pro_crm_products').update({ trade: 'hardscape', catalog_item_id: itemId }).eq('id', product.id).eq('owner_id', user.id);
  }

  let hidden = 0;
  if (parsed.data.hideStarter) {
    let query = service.from('trade_catalog_items').update({ is_active: false }).eq('trade', 'hardscape').ilike('description', STARTER_MARK);
    if (importedIds.length) query = query.not('id', 'in', `(${importedIds.join(',')})`);
    const { data } = await query.select('id');
    hidden = data?.length ?? 0;
  }

  return NextResponse.json({ created, updated, hidden, failed });
}

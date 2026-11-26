import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

const SETUP = 'Materials lists are not ready. Apply supabase/migrations/178_estimate_materials.sql.';
const missing = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /estimate_materials/.test(error.message ?? ''));

const materialSchema = z.object({
  catalogItemId: z.string().uuid().nullish(),
  productId: z.string().uuid().nullish(),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120).nullish(),
  options: z.string().trim().max(300).nullish(),
  area: z.string().trim().max(120).nullish(),
  unit: z.string().trim().min(1).max(40),
  qty: z.number().min(0).max(9_999_999),
});
const bodySchema = z.object({ materials: z.array(materialSchema).max(200) });

async function ownEstimate(id: string) {
  const { error, user } = await requireContractor();
  if (error || !user) return { error: error ?? NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  const db = createServiceRoleClient();
  const { data } = await db.from('pro_crm_estimates').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle();
  if (!data) return { error: NextResponse.json({ error: 'Estimate not found' }, { status: 404 }) };
  return { userId: user.id, db };
}

/** GET /api/crm/estimates/[id]/materials — the estimate's materials list. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const scope = await ownEstimate(id);
  if ('error' in scope) return scope.error;
  const { data, error } = await scope.db
    .from('pro_crm_estimate_materials' as never)
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: missing(error) ? SETUP : error.message }, { status: missing(error) ? 503 : 500 });
  return NextResponse.json({ materials: data ?? [] });
}

/** PUT /api/crm/estimates/[id]/materials { materials } — replace the list. */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const scope = await ownEstimate(id);
  if ('error' in scope) return scope.error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid materials' }, { status: 400 });

  const table = scope.db.from('pro_crm_estimate_materials' as never);
  const removed = await scope.db.from('pro_crm_estimate_materials' as never).delete().eq('estimate_id', id);
  if (removed.error) return NextResponse.json({ error: missing(removed.error) ? SETUP : removed.error.message }, { status: missing(removed.error) ? 503 : 500 });
  if (parsed.data.materials.length) {
    const rows = parsed.data.materials.map((m, index) => ({
      owner_id: scope.userId,
      estimate_id: id,
      catalog_item_id: m.catalogItemId ?? null,
      product_id: m.productId ?? null,
      name: m.name,
      brand: m.brand || null,
      options: m.options || null,
      area: m.area || null,
      unit: m.unit,
      qty: m.qty,
      sort_order: index,
    }));
    const { error } = await table.insert(rows as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: parsed.data.materials.length });
}

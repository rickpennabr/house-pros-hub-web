import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import type { CrmDb } from '@/lib/crm/crm-scope';
import { HARDSCAPE_STARTER, type HardscapeCatalogItem } from '@/lib/protrades/hardscape-quote';

const SETUP_ERROR = 'Run migration 170_hardscape_quote_catalog.sql in Supabase to save your prices.';

function tableMissing(message: string | undefined) {
  return Boolean(message && /pro_crm_hardscape_catalog|schema cache|does not exist/i.test(message));
}

interface Row {
  id: string;
  kind: 'service' | 'material';
  name: string;
  unit: string;
  rate_cents: number;
}

/** GET — the pro's hardscape services and materials, or the starter list when none are saved. */
export async function GET() {
  const { error: authError, user } = await requireContractor();
  if (authError || !user) return authError!;
  const supabase = (await createClient()) as unknown as CrmDb;
  const { data, error } = await supabase
    .from('pro_crm_hardscape_catalog')
    .select('id, kind, name, unit, rate_cents')
    .eq('owner_id', user.id)
    .order('kind')
    .order('sort_order');
  if (error) {
    if (tableMissing(error.message)) return NextResponse.json({ items: HARDSCAPE_STARTER, starter: true, setupError: SETUP_ERROR });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return NextResponse.json({ items: HARDSCAPE_STARTER, starter: true });
  const items: HardscapeCatalogItem[] = rows.map((row) => ({
    id: row.id, kind: row.kind, name: row.name, unit: row.unit, rateCents: row.rate_cents,
  }));
  return NextResponse.json({ items, starter: false });
}

const putSchema = z.object({
  items: z.array(z.object({
    kind: z.enum(['service', 'material']),
    name: z.string().trim().min(1).max(120),
    unit: z.string().trim().min(1).max(40),
    rateCents: z.coerce.number().int().min(0).max(100_000_000),
  })).max(200),
});

/** PUT { items } — replace the whole list (order kept). */
export async function PUT(request: NextRequest) {
  const { error: authError, user } = await requireContractor();
  if (authError || !user) return authError!;
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid list' }, { status: 400 });

  const supabase = (await createClient()) as unknown as CrmDb;
  const removed = await supabase.from('pro_crm_hardscape_catalog').delete().eq('owner_id', user.id);
  if (removed.error) {
    const message = tableMissing(removed.error.message) ? SETUP_ERROR : removed.error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  if (parsed.data.items.length > 0) {
    const { error } = await supabase.from('pro_crm_hardscape_catalog').insert(
      parsed.data.items.map((item, index) => ({
        owner_id: user.id,
        kind: item.kind,
        name: item.name,
        unit: item.unit,
        rate_cents: item.rateCents,
        sort_order: index,
      }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return GET();
}

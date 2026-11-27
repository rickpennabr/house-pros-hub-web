import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireContractor } from '@/lib/crm/require-contractor';
import { DEFAULT_TRIP_TYPES } from '@/lib/crm/trip-track';

const SETUP_ERROR = 'Run the trip tracking database update (migration 188) to track trips.';

/** GET /api/crm/mileage/trip-types: the pro's trip types (the defaults are added the first time). */
export async function GET() {
  const { error: authError, user, supabase } = await requireContractor();
  if (authError || !user) return authError;
  const db = supabase as unknown as SupabaseClient;
  const list = () => db.from('pro_crm_trip_types').select('id, label, sort_order').eq('owner_id', user.id).order('sort_order').order('label');
  let { data, error } = await list();
  if (error) return NextResponse.json({ error: /trip_types/.test(error.message) ? SETUP_ERROR : error.message }, { status: 400 });
  if (!data || data.length === 0) {
    await db
      .from('pro_crm_trip_types')
      .insert(DEFAULT_TRIP_TYPES.map((label, index) => ({ owner_id: user.id, label, sort_order: index * 10 })));
    ({ data, error } = await list());
  }
  return NextResponse.json({ types: (data ?? []).map((row) => ({ id: row.id, label: row.label })) });
}

/** POST /api/crm/mileage/trip-types { label }: a new type, kept for next time. */
export async function POST(request: NextRequest) {
  const { error: authError, user, supabase } = await requireContractor();
  if (authError || !user) return authError;
  const db = supabase as unknown as SupabaseClient;
  const body = (await request.json().catch(() => ({}))) as { label?: unknown };
  const label = typeof body.label === 'string' ? body.label.trim().replace(/\s+/g, ' ') : '';
  if (!label || label.length > 40) return NextResponse.json({ error: 'Name the trip type (up to 40 characters).' }, { status: 400 });
  const { data: existing } = await db.from('pro_crm_trip_types').select('id, label').eq('owner_id', user.id).ilike('label', label).maybeSingle();
  if (existing) return NextResponse.json({ type: existing });
  const { data, error } = await db
    .from('pro_crm_trip_types')
    .insert({ owner_id: user.id, label, sort_order: 500 })
    .select('id, label')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Could not add the type' }, { status: 400 });
  return NextResponse.json({ type: data }, { status: 201 });
}

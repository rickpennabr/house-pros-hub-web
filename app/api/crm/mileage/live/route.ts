import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireContractor } from '@/lib/crm/require-contractor';
import { isValidPoint, type TrackPoint } from '@/lib/crm/trip-track';

/** Most points kept for one trip in progress (about 8 hours at one point every 5 seconds). */
const MAX_POINTS = 6000;
const SETUP_ERROR = 'Run the trip tracking database update (migration 188) to track trips.';

function uuidOrNull(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

async function ctx() {
  const { error, user, supabase } = await requireContractor();
  return { error, user, db: supabase as unknown as SupabaseClient };
}

/** GET /api/crm/mileage/live: the trip in progress, if any (to continue after a refresh). */
export async function GET() {
  const { error, user, db } = await ctx();
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error: readError } = await db.from('pro_crm_trip_live').select('*').eq('owner_id', user.id).maybeSingle();
  if (readError) return NextResponse.json({ live: null, setupError: /trip_live/.test(readError.message) ? SETUP_ERROR : readError.message });
  return NextResponse.json({ live: data ?? null });
}

/** POST /api/crm/mileage/live { vehicleId, tripTypeId, customerId }: start a trip (replaces any old one). */
export async function POST(request: NextRequest) {
  const { error, user, db } = await ctx();
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const vehicleId = uuidOrNull(body.vehicleId);
  if (!vehicleId) return NextResponse.json({ error: 'Pick a vehicle' }, { status: 400 });
  const { data: vehicle } = await db.from('pro_crm_vehicles').select('id').eq('id', vehicleId).eq('owner_id', user.id).maybeSingle();
  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
  const customerId = uuidOrNull(body.customerId);
  if (customerId) {
    const { data: customer } = await db.from('pro_crm_customers').select('id').eq('id', customerId).eq('owner_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }
  const row = {
    owner_id: user.id,
    vehicle_id: vehicleId,
    trip_type_id: uuidOrNull(body.tripTypeId),
    customer_id: customerId,
    started_at: new Date().toISOString(),
    points: [],
    updated_at: new Date().toISOString(),
  };
  const { data, error: saveError } = await db.from('pro_crm_trip_live').upsert(row).select('*').single();
  if (saveError) return NextResponse.json({ error: /trip_live/.test(saveError.message) ? SETUP_ERROR : saveError.message }, { status: 400 });
  return NextResponse.json({ live: data }, { status: 201 });
}

/** PATCH /api/crm/mileage/live { points: TrackPoint[] }: add the latest GPS points. */
export async function PATCH(request: NextRequest) {
  const { error, user, db } = await ctx();
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { points?: unknown };
  const incoming = Array.isArray(body.points) ? (body.points.filter(isValidPoint) as TrackPoint[]).slice(0, 1000) : [];
  const { data: live } = await db.from('pro_crm_trip_live').select('points').eq('owner_id', user.id).maybeSingle();
  if (!live) return NextResponse.json({ error: 'No trip in progress' }, { status: 404 });
  const existing = Array.isArray(live.points) ? (live.points as TrackPoint[]) : [];
  const lastT = existing.length ? existing[existing.length - 1].t : 0;
  const merged = [...existing, ...incoming.filter((p) => p.t > lastT)].slice(-MAX_POINTS);
  const compact = merged.map((p) => ({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6, t: p.t, ...(p.acc !== undefined ? { acc: Math.round(p.acc) } : {}) }));
  const { error: saveError } = await db.from('pro_crm_trip_live').update({ points: compact, updated_at: new Date().toISOString() }).eq('owner_id', user.id);
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: compact.length });
}

/** DELETE /api/crm/mileage/live: cancel the trip in progress (nothing is saved). */
export async function DELETE() {
  const { error, user, db } = await ctx();
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await db.from('pro_crm_trip_live').delete().eq('owner_id', user.id);
  return NextResponse.json({ ok: true });
}

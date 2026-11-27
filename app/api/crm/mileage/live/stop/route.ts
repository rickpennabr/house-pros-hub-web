import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireContractor } from '@/lib/crm/require-contractor';
import { priceTrip, tripColumns, vehicleFromRow } from '@/lib/crm/mileage';
import { cleanPoints, encodePolyline, isValidPoint, purposeForType, routeMiles, simplify, type TrackPoint } from '@/lib/crm/trip-track';

/** Street address for a GPS point, through the Hub's own geocoder (Clark County, OSM, Google). */
async function placeLabel(origin: string, cookie: string, point: TrackPoint | undefined): Promise<string | null> {
  if (!point) return null;
  try {
    const res = await fetch(`${origin}/api/geocode?latitude=${point.lat}&longitude=${point.lng}`, {
      headers: { cookie },
      signal: AbortSignal.timeout(6000),
    });
    const body = (await res.json().catch(() => null)) as { address?: { street?: string; city?: string; state?: string } | null } | null;
    const address = body?.address;
    const label = address ? [address.street, address.city, address.state].filter(Boolean).join(', ') : null;
    return label ? label.slice(0, 200) : `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
  } catch {
    return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
  }
}

/**
 * POST /api/crm/mileage/live/stop { points?, miles?, note?, tripDate }
 * Ends the trip in progress: cleans the GPS points, measures the route, prices it with the
 * vehicle's cost per mile and saves it as a tracked trip with its route. Miles typed by the pro win.
 */
export async function POST(request: NextRequest) {
  const { error: authError, user, supabase } = await requireContractor();
  if (authError || !user) return authError;
  const db = supabase as unknown as SupabaseClient;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const { data: live, error: liveError } = await db.from('pro_crm_trip_live').select('*').eq('owner_id', user.id).maybeSingle();
  if (liveError) return NextResponse.json({ error: liveError.message }, { status: 400 });
  if (!live) return NextResponse.json({ error: 'No trip in progress' }, { status: 404 });
  if (!live.vehicle_id) return NextResponse.json({ error: 'The vehicle of this trip was removed. Cancel it and start again.' }, { status: 400 });

  const saved = Array.isArray(live.points) ? (live.points as TrackPoint[]) : [];
  const lastT = saved.length ? saved[saved.length - 1].t : 0;
  const latest = Array.isArray(body.points) ? (body.points.filter(isValidPoint) as TrackPoint[]).filter((p) => p.t > lastT) : [];
  const points = cleanPoints([...saved, ...latest]);
  const measured = routeMiles(points);
  const typed = typeof body.miles === 'number' && body.miles > 0 && body.miles <= 5000 ? Math.round(body.miles * 10) / 10 : null;
  const miles = typed ?? measured;
  if (!(miles >= 0.1)) {
    return NextResponse.json({ error: 'This trip is under 0.1 mile. Type the miles, or cancel it.', measured }, { status: 400 });
  }

  const { data: vehicle } = await db.from('pro_crm_vehicles').select('*').eq('id', live.vehicle_id).eq('owner_id', user.id).maybeSingle();
  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
  const priced = priceTrip(vehicleFromRow(vehicle), miles);
  if ('error' in priced) return NextResponse.json({ error: priced.error }, { status: 400 });

  let typeLabel: string | null = null;
  if (live.trip_type_id) {
    const { data: type } = await db.from('pro_crm_trip_types').select('label').eq('id', live.trip_type_id).maybeSingle();
    typeLabel = type?.label ?? null;
  }

  const origin = request.nextUrl.origin;
  const cookie = request.headers.get('cookie') ?? '';
  const [fromLabel, toLabel] = await Promise.all([placeLabel(origin, cookie, points[0]), placeLabel(origin, cookie, points[points.length - 1])]);
  const tripDate =
    typeof body.tripDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.tripDate) ? body.tripDate : new Date().toISOString().slice(0, 10);
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const route = simplify(points, 500);
  const first = points[0];
  const last = points[points.length - 1];

  const row = {
    ...tripColumns(
      user.id,
      {
        vehicleId: live.vehicle_id,
        customerId: live.customer_id ?? null,
        estimateId: null,
        projectId: null,
        tripDate,
        purpose: purposeForType(typeLabel),
        origin: fromLabel,
        destination: toLabel,
        miles,
        note,
      },
      vehicle.name,
      priced
    ),
    trip_type_id: live.trip_type_id ?? null,
    started_at: live.started_at,
    ended_at: new Date().toISOString(),
    tracked: true,
    ...(first ? { start_lat: first.lat, start_lng: first.lng } : {}),
    ...(last ? { end_lat: last.lat, end_lng: last.lng } : {}),
    ...(route.length >= 2 ? { route_polyline: encodePolyline(route) } : {}),
  };
  const { data: trip, error: saveError } = await db.from('pro_crm_mileage_trips').insert(row).select('id').single();
  if (saveError || !trip) return NextResponse.json({ error: saveError?.message ?? 'Could not save the trip' }, { status: 500 });
  await db.from('pro_crm_trip_live').delete().eq('owner_id', user.id);

  return NextResponse.json(
    {
      id: trip.id,
      miles,
      measuredMiles: measured,
      amountCents: priced.amountCents,
      minutes: Math.max(1, Math.round((Date.now() - new Date(live.started_at).getTime()) / 60000)),
      from: fromLabel,
      to: toLabel,
      hasRoute: route.length >= 2,
    },
    { status: 201 }
  );
}

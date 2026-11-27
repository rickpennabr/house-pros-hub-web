import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireContractor } from '@/lib/crm/require-contractor';

/**
 * GET /api/crm/mileage/trips/[id]/map?w=600&h=300
 * The trip's route as a small map image (Google Static Maps), drawn server side so the key never
 * shows in the page. Needs "Maps Static API" enabled on the Google key. 404 when no route or key.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError, user, supabase } = await requireContractor();
  if (authError || !user) return authError;
  const { id } = await params;
  const key = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: 'No map key' }, { status: 404 });

  const db = supabase as unknown as SupabaseClient;
  const { data: trip } = await db
    .from('pro_crm_mileage_trips')
    .select('route_polyline, start_lat, start_lng, end_lat, end_lng')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!trip?.route_polyline) return NextResponse.json({ error: 'No route' }, { status: 404 });

  const w = Math.min(640, Math.max(120, Number(request.nextUrl.searchParams.get('w')) || 600));
  const h = Math.min(640, Math.max(80, Number(request.nextUrl.searchParams.get('h')) || 300));
  const query = new URLSearchParams({ size: `${w}x${h}`, scale: '2', maptype: 'roadmap', key });
  query.append('path', `color:0xdc2626ff|weight:5|enc:${trip.route_polyline}`);
  if (trip.start_lat != null) query.append('markers', `size:small|color:0x16a34a|label:A|${trip.start_lat},${trip.start_lng}`);
  if (trip.end_lat != null) query.append('markers', `size:small|color:0x000000|label:B|${trip.end_lat},${trip.end_lng}`);

  const res = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${query}`, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res || !res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) {
    return NextResponse.json({ error: 'Map not available' }, { status: 404 });
  }
  return new NextResponse(await res.arrayBuffer(), {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

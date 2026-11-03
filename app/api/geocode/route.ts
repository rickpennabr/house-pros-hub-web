import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { createClient } from '@/lib/supabase/server';

const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const CACHE_LIMIT = 400;

interface Coordinates {
  latitude: number;
  longitude: number;
}

const cache = new Map<string, Coordinates | null>();

function remember(key: string, value: Coordinates | null) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}

/** Drop unit numbers so a street match still succeeds when the unit is unknown to the geocoder. */
function withoutUnit(address: string): string {
  return address
    .replace(/,?\s*(apt|apartment|unit|suite|ste|#)\s*[^,]+/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,{2,}/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function lookupCensus(address: string): Promise<Coordinates | null> {
  const url = new URL(CENSUS_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('format', 'json');

  const response = await fetch(url);
  if (!response.ok) return null;

  const body = (await response.json()) as {
    result?: { addressMatches?: { coordinates?: { x?: number; y?: number } }[] };
  };
  const point = body.result?.addressMatches?.[0]?.coordinates;
  if (typeof point?.y !== 'number' || typeof point?.x !== 'number') return null;
  return { latitude: point.y, longitude: point.x };
}

/**
 * GET /api/geocode?address=
 * Turn a US street address into coordinates for the CRM and admin maps.
 * Uses the Census geocoder so the Maps JavaScript key does not need the Geocoding API.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await checkRateLimit(request, 'general', user.id);
    if (limited) return limited;

    const address = request.nextUrl.searchParams.get('address')?.trim() ?? '';
    if (address.length < 5 || address.length > 240) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const key = address.toLowerCase();
    if (cache.has(key)) {
      return NextResponse.json({ coordinates: cache.get(key) ?? null });
    }

    let coordinates = await lookupCensus(address);
    const stripped = withoutUnit(address);
    if (!coordinates && stripped.length >= 5 && stripped.toLowerCase() !== key) {
      coordinates = await lookupCensus(stripped);
    }

    remember(key, coordinates);
    return NextResponse.json({ coordinates });
  } catch (err) {
    console.error('GET /api/geocode', err);
    return NextResponse.json({ error: 'Could not look up that address' }, { status: 502 });
  }
}

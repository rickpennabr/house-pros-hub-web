import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { createClient } from '@/lib/supabase/server';

const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const CACHE_LIMIT = 400;

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface StreetAddress {
  street: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

const cache = new Map<string, Coordinates | null>();
const reverseCache = new Map<string, StreetAddress | null>();

function remember<T>(store: Map<string, T>, key: string, value: T) {
  if (store.size >= CACHE_LIMIT) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, value);
}

function addressPart(
  parts: { long_name?: string; short_name?: string; types?: string[] }[] | undefined,
  type: string,
  short = false
): string {
  const match = parts?.find((part) => part.types?.includes(type));
  if (!match) return '';
  return (short ? match.short_name : match.long_name) || '';
}

async function reverseGoogle(latitude: number, longitude: number): Promise<StreetAddress | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${latitude},${longitude}`);
  url.searchParams.set('key', apiKey);
  const response = await fetch(url);
  if (!response.ok) return null;
  const body = (await response.json()) as {
    status?: string;
    results?: { address_components?: { long_name?: string; short_name?: string; types?: string[] }[] }[];
  };
  if (body.status !== 'OK' || !body.results?.length) return null;
  const parts = body.results[0].address_components;
  const street = [addressPart(parts, 'street_number'), addressPart(parts, 'route')].filter(Boolean).join(' ');
  const city = addressPart(parts, 'locality') || addressPart(parts, 'postal_town') || addressPart(parts, 'sublocality');
  if (!street && !city) return null;
  return {
    street,
    line2: addressPart(parts, 'subpremise'),
    city,
    state: addressPart(parts, 'administrative_area_level_1', true),
    zip: addressPart(parts, 'postal_code'),
  };
}

const CLARK_PARCELS =
  'https://maps.clarkcountynv.gov/arcgis/rest/services/GISMO/Address/MapServer/2/query';

const STREET_SUFFIX: Record<string, string> = {
  ST: 'St',
  AVE: 'Ave',
  AV: 'Ave',
  BLVD: 'Blvd',
  DR: 'Dr',
  RD: 'Rd',
  LN: 'Ln',
  CT: 'Ct',
  CIR: 'Cir',
  PL: 'Pl',
  WAY: 'Way',
  PKWY: 'Pkwy',
  HWY: 'Hwy',
  TER: 'Ter',
  TRL: 'Trl',
  LOOP: 'Loop',
  RUN: 'Run',
  ALY: 'Aly',
  SQ: 'Sq',
};

/** Unincorporated Clark County places that USPS addresses as Las Vegas. */
const LAS_VEGAS_MAILING = new Set([
  'SUNRISE MANOR',
  'WINCHESTER',
  'PARADISE',
  'SPRING VALLEY',
  'ENTERPRISE',
  'WHITNEY',
]);

function titleWord(value: string): string {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function postalCity(raw: string): string {
  const city = raw.trim().toUpperCase();
  if (!city) return '';
  if (city === 'LAS VEGAS' || LAS_VEGAS_MAILING.has(city)) return 'Las Vegas';
  return titleWord(city);
}

interface ClarkParcel {
  strno?: number | string;
  strdir?: string;
  strname?: string;
  strtype?: string;
  strunit?: string;
  City?: string;
}

/**
 * The parcel under the pin. Clark County's address points include house numbers
 * inside mobile home parks that OpenStreetMap only knows as the nearest road.
 */
async function reverseClark(latitude: number, longitude: number): Promise<StreetAddress | null> {
  const url = new URL(CLARK_PARCELS);
  url.searchParams.set('geometry', `${longitude},${latitude}`);
  url.searchParams.set('geometryType', 'esriGeometryPoint');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', 'strno,strdir,strname,strtype,strunit,City');
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('resultRecordCount', '1');
  url.searchParams.set('f', 'json');

  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) return null;
  const body = (await response.json()) as { features?: { attributes?: ClarkParcel }[] };
  const parcel = body.features?.[0]?.attributes;
  if (!parcel) return null;

  const number = String(parcel.strno ?? '').trim();
  const name = String(parcel.strname ?? '').trim();
  if (!number || !name || number === '0') return null;
  const direction = String(parcel.strdir ?? '').trim().toUpperCase();
  const suffixRaw = String(parcel.strtype ?? '').trim().toUpperCase();
  const suffix = STREET_SUFFIX[suffixRaw] || (suffixRaw ? titleWord(suffixRaw) : '');
  const street = [number, direction, titleWord(name), suffix].filter(Boolean).join(' ');
  return {
    street,
    line2: String(parcel.strunit ?? '').trim(),
    city: postalCity(parcel.City ?? ''),
    state: 'NV',
    zip: '',
  };
}

async function reverseNominatim(latitude: number, longitude: number): Promise<StreetAddress | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  const response = await fetch(url, {
    headers: { 'User-Agent': 'HouseProsHub/1.0 (jobsite map)', Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    address?: {
      house_number?: string;
      road?: string;
      city?: string;
      town?: string;
      village?: string;
      suburb?: string;
      state?: string;
      postcode?: string;
      'ISO3166-2-lvl4'?: string;
    };
  };
  const address = body.address;
  if (!address) return null;
  const street = [address.house_number, address.road].filter(Boolean).join(' ');
  const city = address.city || address.town || address.village || address.suburb || '';
  if (!street && !city) return null;
  const iso = address['ISO3166-2-lvl4']?.split('-').pop() || '';
  const state = address.state && address.state.length === 2 ? address.state.toUpperCase() : iso || address.state || '';
  return { street, line2: '', city, state, zip: address.postcode || '' };
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
 * GET /api/geocode?address= turns a US street address into coordinates.
 * GET /api/geocode?latitude=&longitude= turns a map pin into a street address.
 * Forward lookup uses the Census geocoder. Reverse lookup uses the Clark County
 * parcel under the pin, then Google, then OpenStreetMap.
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

    const latitudeParam = request.nextUrl.searchParams.get('latitude');
    const longitudeParam = request.nextUrl.searchParams.get('longitude');
    if (latitudeParam !== null && longitudeParam !== null) {
      const latitude = Number(latitudeParam);
      const longitude = Number(longitudeParam);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return NextResponse.json({ error: 'A map point is required' }, { status: 400 });
      }
      const pointKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
      if (reverseCache.has(pointKey)) {
        return NextResponse.json({ address: reverseCache.get(pointKey) ?? null });
      }
      const [parcel, osm] = await Promise.all([
        reverseClark(latitude, longitude).catch(() => null),
        reverseNominatim(latitude, longitude).catch(() => null),
      ]);
      const found = parcel?.street
        ? {
            street: parcel.street,
            line2: parcel.line2 || osm?.line2 || '',
            city: parcel.city || osm?.city || '',
            state: parcel.state || osm?.state || '',
            zip: osm?.zip || '',
          }
        : (await reverseGoogle(latitude, longitude)) ?? osm;
      remember(reverseCache, pointKey, found);
      return NextResponse.json({ address: found });
    }

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

    remember(cache, key, coordinates);
    return NextResponse.json({ coordinates });
  } catch (err) {
    console.error('GET /api/geocode', err);
    return NextResponse.json({ error: 'Could not look up that address' }, { status: 502 });
  }
}

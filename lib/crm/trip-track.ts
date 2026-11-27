/**
 * GPS trip math, shared by the phone tracker and the server: distance, cleaning noisy fixes,
 * simplifying the route, and Google's encoded polyline format (for the route map).
 * Pure functions, unit tested.
 */

export interface TrackPoint {
  lat: number;
  lng: number;
  /** Milliseconds since epoch. */
  t: number;
  /** Accuracy radius in meters, when the phone gives one. */
  acc?: number;
}

const EARTH_MILES = 3958.8;
const METERS_PER_MILE = 1609.344;

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidPoint(p: unknown): p is TrackPoint {
  if (!p || typeof p !== 'object') return false;
  const { lat, lng, t, acc } = p as Record<string, unknown>;
  return (
    typeof lat === 'number' && Math.abs(lat) <= 90 &&
    typeof lng === 'number' && Math.abs(lng) <= 180 &&
    typeof t === 'number' && Number.isFinite(t) &&
    (acc === undefined || (typeof acc === 'number' && acc >= 0))
  );
}

/**
 * Drops fixes that are too inaccurate (> 50 m), impossible jumps (> 100 mph) and jitter while
 * standing still (< 15 m from the last kept point). Keeps time order.
 */
export function cleanPoints(points: TrackPoint[], opts: { maxAccuracyM?: number; maxMph?: number; minMoveM?: number } = {}): TrackPoint[] {
  const maxAcc = opts.maxAccuracyM ?? 50;
  const maxMph = opts.maxMph ?? 100;
  const minMoveMiles = (opts.minMoveM ?? 15) / METERS_PER_MILE;
  const sorted = points.filter(isValidPoint).filter((p) => p.acc === undefined || p.acc <= maxAcc).sort((a, b) => a.t - b.t);
  const kept: TrackPoint[] = [];
  for (const point of sorted) {
    const last = kept[kept.length - 1];
    if (!last) {
      kept.push(point);
      continue;
    }
    const miles = haversineMiles(last, point);
    if (miles < minMoveMiles) continue;
    const hours = (point.t - last.t) / 3_600_000;
    if (hours > 0 && miles / hours > maxMph) continue;
    kept.push(point);
  }
  return kept;
}

export function routeMiles(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += haversineMiles(points[i - 1], points[i]);
  return Math.round(total * 10) / 10;
}

/** Perpendicular distance (rough, in degrees) from p to the line a–b; fine for simplifying a route. */
function lineDistance(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) return Math.hypot(p.lng - a.lng, p.lat - a.lat);
  const t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.lng - (a.lng + t * dx), p.lat - (a.lat + t * dy));
}

function douglasPeucker(points: TrackPoint[], tolerance: number): TrackPoint[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let worst = -1;
    let worstAt = -1;
    for (let i = start + 1; i < end; i += 1) {
      const d = lineDistance(points[i], points[start], points[end]);
      if (d > worst) {
        worst = d;
        worstAt = i;
      }
    }
    if (worstAt > 0 && worst > tolerance) {
      keep[worstAt] = 1;
      stack.push([start, worstAt], [worstAt, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplifies a route to at most `maxPoints`, keeping its shape (raises the tolerance until it fits). */
export function simplify(points: TrackPoint[], maxPoints = 500): TrackPoint[] {
  if (points.length <= maxPoints) return points;
  let tolerance = 0.00001; // about 1 m
  let result = douglasPeucker(points, tolerance);
  while (result.length > maxPoints && tolerance < 1) {
    tolerance *= 2;
    result = douglasPeucker(points, tolerance);
  }
  return result;
}

/** Google encoded polyline (precision 5). */
export function encodePolyline(points: Array<{ lat: number; lng: number }>): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  const enc = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let chunk = '';
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return chunk + String.fromCharCode(v + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += enc(lat - lastLat) + enc(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length + 1);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** Default trip types, offered the first time a pro tracks a trip. */
export const DEFAULT_TRIP_TYPES = [
  'Estimate',
  'Project visit',
  'Sales follow-up',
  'Repair visit',
  'Maintenance',
  'Supply run',
  'Inspection',
  'Other',
] as const;

/** The older purpose column, set from the trip type so existing reports keep working. */
export function purposeForType(label: string | null | undefined): 'job' | 'estimate' | 'supply_run' | 'other' {
  const text = (label ?? '').toLowerCase();
  if (text.includes('estimate')) return 'estimate';
  if (text.includes('supply') || text.includes('material')) return 'supply_run';
  if (text === 'other' || text.includes('personal')) return 'other';
  return 'job';
}

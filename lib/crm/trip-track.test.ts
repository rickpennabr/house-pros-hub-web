import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanPoints,
  decodePolyline,
  encodePolyline,
  haversineMiles,
  purposeForType,
  routeMiles,
  simplify,
  type TrackPoint,
} from './trip-track';

test('haversine: Las Vegas Strip to Henderson is about 11-12 miles', () => {
  const miles = haversineMiles({ lat: 36.1147, lng: -115.1728 }, { lat: 36.0395, lng: -114.9817 });
  assert.ok(miles > 11 && miles < 12.5, String(miles));
});

test('cleanPoints drops inaccurate fixes, jitter and impossible jumps', () => {
  const start = Date.UTC(2026, 0, 1, 9);
  const points: TrackPoint[] = [
    { lat: 36.1, lng: -115.1, t: start, acc: 10 },
    { lat: 36.10001, lng: -115.10001, t: start + 5_000, acc: 10 }, // jitter (about 1.4 m)
    { lat: 36.2, lng: -115.1, t: start + 6_000, acc: 10 }, // 7 miles in 6 s: impossible
    { lat: 36.11, lng: -115.1, t: start + 60_000, acc: 200 }, // inaccurate
    { lat: 36.11, lng: -115.1, t: start + 90_000, acc: 15 }, // good: about 0.7 mi in 90 s
  ];
  const kept = cleanPoints(points);
  assert.equal(kept.length, 2);
  assert.equal(routeMiles(kept), 0.7);
});

test('polyline round trip (Google example)', () => {
  const pts = [
    { lat: 38.5, lng: -120.2 },
    { lat: 40.7, lng: -120.95 },
    { lat: 43.252, lng: -126.453 },
  ];
  const encoded = encodePolyline(pts);
  assert.equal(encoded, '_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.deepEqual(decodePolyline(encoded), pts);
});

test('simplify keeps the ends and fits under the limit', () => {
  const points: TrackPoint[] = Array.from({ length: 2000 }, (_, i) => ({
    lat: 36 + i * 0.0001,
    lng: -115 + Math.sin(i / 50) * 0.01,
    t: i * 1000,
  }));
  const out = simplify(points, 300);
  assert.ok(out.length <= 300);
  assert.deepEqual(out[0], points[0]);
  assert.deepEqual(out[out.length - 1], points[points.length - 1]);
});

test('trip type sets the older purpose', () => {
  assert.equal(purposeForType('Estimate'), 'estimate');
  assert.equal(purposeForType('Supply run'), 'supply_run');
  assert.equal(purposeForType('Repair visit'), 'job');
  assert.equal(purposeForType('Other'), 'other');
});

import { requestCurrentLocation, type CaptureLocation } from '@/lib/media/capture-location';

export interface PhotoSpot {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  headingDeg: number | null;
}

/** GPS and compass direction stored in a camera JPEG. Phone browsers often keep this after the shutter. */
export async function readPhotoSpot(file: File): Promise<PhotoSpot | null> {
  const name = file.name.toLowerCase();
  const jpeg = file.type === 'image/jpeg' || name.endsWith('.jpg') || name.endsWith('.jpeg');
  if (!jpeg) return null;
  try {
    return parseJpegGps(new DataView(await file.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Device compass, when the browser allows it. Null on a plain http page. */
export function readCompassHeading(): Promise<number | null> {
  if (typeof window === 'undefined' || !window.isSecureContext) return Promise.resolve(null);
  const orientation = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<PermissionState | 'granted' | 'denied'>;
  };
  const listen = () => new Promise<number | null>((resolve) => {
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('deviceorientation', onOrient);
      resolve(value);
    };
    const onOrient = (event: DeviceOrientationEvent) => {
      const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof webkit === 'number' && Number.isFinite(webkit)) finish(normalize(webkit));
      else if (typeof event.alpha === 'number' && Number.isFinite(event.alpha)) finish(normalize(360 - event.alpha));
    };
    window.addEventListener('deviceorientation', onOrient);
    window.setTimeout(() => finish(null), 700);
  });

  if (typeof orientation.requestPermission === 'function') {
    return orientation.requestPermission().then((result) => (result === 'granted' ? listen() : null)).catch(() => null);
  }
  return listen();
}

export async function geocodeAddress(address: string): Promise<PhotoSpot | null> {
  const query = address.replace(/ · /g, ', ').replace(/\s+/g, ' ').trim();
  if (query.length < 5) return null;
  try {
    const response = await fetch(`/api/geocode?address=${encodeURIComponent(query)}`, { credentials: 'include' });
    const body = (await response.json()) as { coordinates?: { latitude?: number; longitude?: number } | null };
    const latitude = body.coordinates?.latitude;
    const longitude = body.coordinates?.longitude;
    if (!response.ok || typeof latitude !== 'number' || typeof longitude !== 'number') return null;
    return { latitude, longitude, accuracyM: 80, headingDeg: null };
  } catch {
    return null;
  }
}

/** Prefer the picture's own GPS, then a live fix, then the job address. */
export async function locateShot(file: File, address: string, live: CaptureLocation | null, headingDeg: number | null): Promise<PhotoSpot | null> {
  const fromFile = await readPhotoSpot(file);
  if (fromFile) return { ...fromFile, headingDeg: fromFile.headingDeg ?? headingDeg };
  if (live) return { latitude: live.latitude, longitude: live.longitude, accuracyM: live.accuracyM, headingDeg };
  return geocodeAddress(address);
}

function normalize(value: number): number {
  return ((value % 360) + 360) % 360;
}

function parseJpegGps(view: DataView): PhotoSpot | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    if (marker === 0xffda || marker === 0xffd9) break;
    const size = view.getUint16(offset + 2);
    if (size < 2) break;
    if (marker === 0xffe1 && ascii(view, offset + 4, 4) === 'Exif') {
      return readExif(view, offset + 10);
    }
    offset += 2 + size;
  }
  return null;
}

function readExif(view: DataView, tiff: number): PhotoSpot | null {
  if (tiff + 8 > view.byteLength) return null;
  const order = view.getUint16(tiff);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return null;
  if (view.getUint16(tiff + 2, little) !== 42) return null;
  const ifd0 = tiff + view.getUint32(tiff + 4, little);
  const gpsPointer = findEntry(view, ifd0, little, 0x8825);
  if (!gpsPointer) return null;
  const gps = tiff + gpsPointer.value;
  const latitude = readCoordinate(view, tiff, gps, little, 0x0002, 0x0001);
  const longitude = readCoordinate(view, tiff, gps, little, 0x0004, 0x0003);
  if (latitude == null || longitude == null) return null;
  return {
    latitude,
    longitude,
    accuracyM: null,
    headingDeg: readRational(view, tiff, gps, little, 0x0011),
  };
}

interface Entry {
  type: number;
  count: number;
  value: number;
  at: number;
}

function findEntry(view: DataView, ifd: number, little: boolean, tag: number): Entry | null {
  if (ifd + 2 > view.byteLength) return null;
  const count = view.getUint16(ifd, little);
  for (let index = 0; index < count; index += 1) {
    const at = ifd + 2 + index * 12;
    if (at + 12 > view.byteLength) return null;
    if (view.getUint16(at, little) !== tag) continue;
    return {
      type: view.getUint16(at + 2, little),
      count: view.getUint32(at + 4, little),
      value: view.getUint32(at + 8, little),
      at,
    };
  }
  return null;
}

function payloadOffset(tiff: number, entry: Entry): number {
  const width = entry.type === 5 || entry.type === 10 ? 8 : entry.type === 3 || entry.type === 8 ? 2 : 4;
  return width * entry.count <= 4 ? entry.at + 8 : tiff + entry.value;
}

function readCoordinate(view: DataView, tiff: number, ifd: number, little: boolean, tag: number, refTag: number): number | null {
  const entry = findEntry(view, ifd, little, tag);
  if (!entry || entry.count < 3) return null;
  const base = payloadOffset(tiff, entry);
  if (base + 24 > view.byteLength) return null;
  const degrees = rational(view, base, little);
  const minutes = rational(view, base + 8, little);
  const seconds = rational(view, base + 16, little);
  let value = degrees + minutes / 60 + seconds / 3600;
  const ref = findEntry(view, ifd, little, refTag);
  if (ref) {
    const letter = String.fromCharCode(view.getUint8(payloadOffset(tiff, ref)));
    if (letter === 'S' || letter === 'W') value = -value;
  }
  return Number.isFinite(value) ? value : null;
}

function readRational(view: DataView, tiff: number, ifd: number, little: boolean, tag: number): number | null {
  const entry = findEntry(view, ifd, little, tag);
  if (!entry) return null;
  const base = payloadOffset(tiff, entry);
  if (base + 8 > view.byteLength) return null;
  const value = rational(view, base, little);
  return Number.isFinite(value) ? normalize(value) : null;
}

function rational(view: DataView, offset: number, little: boolean): number {
  const denominator = view.getUint32(offset + 4, little);
  if (!denominator) return 0;
  return view.getUint32(offset, little) / denominator;
}

function ascii(view: DataView, offset: number, length: number): string {
  let text = '';
  for (let index = 0; index < length && offset + index < view.byteLength; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }
  return text;
}

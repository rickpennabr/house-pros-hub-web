export interface CaptureLocation {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

export interface ReverseGeocodeAddress {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

const LOCATION_TIMEOUT_MS = 8000;

type AddressPart = { long_name: string; short_name: string; types: string[] };

/**
 * Ask the browser for the device position. Returns null when the user denies
 * access or the device cannot provide a fix. Callers still keep the photo.
 */
export function requestCurrentLocation(): Promise<CaptureLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 60_000 }
    );
  });
}

function component(parts: AddressPart[] | undefined, type: string, name: 'long_name' | 'short_name' = 'long_name'): string {
  return parts?.find((part) => part.types.includes(type))?.[name] ?? '';
}

/**
 * Turn a GPS fix into a street address with the Maps Geocoding API.
 * Returns null when the key is missing or the lookup fails.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeAddress | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${latitude},${longitude}`);
  url.searchParams.set('key', apiKey);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const body = (await response.json()) as {
      status?: string;
      results?: { address_components?: AddressPart[] }[];
    };
    if (body.status !== 'OK' || !body.results?.length) return null;

    const parts = body.results[0].address_components;
    const streetAddress = [component(parts, 'street_number'), component(parts, 'route')].filter(Boolean).join(' ');
    const city = component(parts, 'locality') || component(parts, 'postal_town') || component(parts, 'sublocality');
    const state = component(parts, 'administrative_area_level_1', 'short_name');
    const zipCode = component(parts, 'postal_code');
    if (!streetAddress && !city) return null;
    return { streetAddress, city, state, zipCode };
  } catch {
    return null;
  }
}

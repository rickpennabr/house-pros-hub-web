import { mailStreetKey } from '@/lib/address/unit';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';

export const HUB_CUSTOMER_NOT_FOUND = 'No confirmed House Pros customer uses that email.';

const PLACE_KINDS = ['house', 'business', 'building'] as const;
export type HubPlaceKind = (typeof PLACE_KINDS)[number];

export interface HubPlace {
  id: string;
  kind: HubPlaceKind;
  name: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}

/** Server-only contact. userId is never sent to the browser. */
export interface HubContact {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  streetAddress: string | null;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  places: HubPlace[];
}

export interface HubMailingAddress {
  streetAddress: string | null;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  placeId: string | null;
  portalKind: HubPlaceKind | null;
}

/** Fields a pro may copy onto their own contact. No account id. */
export interface PublicHubContact {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  streetAddress: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function norm(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function textOrNull(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function placeMatches(place: HubPlace, street: string | null, zip: string | null): boolean {
  const placeStreet = mailStreetKey(place.street);
  const contactStreet = mailStreetKey(street);
  if (!placeStreet || placeStreet !== contactStreet) return false;
  const placeZip = norm(place.zipCode);
  const contactZip = norm(zip);
  if (placeZip && contactZip && placeZip !== contactZip) return false;
  return true;
}

/**
 * Prefer the address on their account. Use a saved place only when it is the
 * same street, or when the account has no street and the place does.
 */
export function mailingFromHub(contact: HubContact): HubMailingAddress {
  const street = contact.streetAddress?.trim() || null;
  if (street) {
    const match = contact.places.find((place) => placeMatches(place, street, contact.zipCode)) ?? null;
    return {
      streetAddress: clip(street, 160),
      apartment: textOrNull(contact.apartment, 40),
      city: textOrNull(contact.city, 80),
      state: textOrNull(contact.state, 40),
      zipCode: textOrNull(contact.zipCode, 20),
      placeId: match?.id ?? null,
      portalKind: match?.kind ?? null,
    };
  }

  const place = contact.places.find((row) => row.street?.trim()) ?? null;
  if (!place) {
    return {
      streetAddress: null,
      apartment: null,
      city: null,
      state: null,
      zipCode: null,
      placeId: null,
      portalKind: null,
    };
  }

  return {
    streetAddress: textOrNull(place.street, 160),
    apartment: null,
    city: textOrNull(place.city, 80),
    state: textOrNull(place.state, 40),
    zipCode: textOrNull(place.zipCode, 20),
    placeId: place.id,
    portalKind: place.kind,
  };
}

/** CRM requires both names. Fall back only when the account left one blank. */
export function hubPersonName(contact: Pick<HubContact, 'firstName' | 'lastName' | 'email'>): {
  firstName: string;
  lastName: string;
} {
  const first = contact.firstName?.trim() ?? '';
  const last = contact.lastName?.trim() ?? '';
  if (first && last) return { firstName: clip(first, 80), lastName: clip(last, 80) };
  if (first) return { firstName: clip(first, 80), lastName: 'Customer' };
  if (last) return { firstName: clip(last, 80), lastName: 'Customer' };

  const local = contact.email.split('@')[0]?.replace(/[._+-]+/g, ' ').trim() || 'Customer';
  const parts = local.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      firstName: clip(parts[0], 80),
      lastName: clip(parts.slice(1).join(' '), 80),
    };
  }
  return { firstName: clip(parts[0] || 'Customer', 80), lastName: 'Customer' };
}

/** Keep a full US number formatted. Leave anything else unchanged. */
export function phoneForCrm(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length === 10) return formatPhoneNumber(national);
  return trimmed.slice(0, 40);
}

export function publicHubContact(contact: HubContact): PublicHubContact {
  const names = hubPersonName(contact);
  const mailing = mailingFromHub(contact);
  return {
    email: contact.email,
    firstName: names.firstName,
    lastName: names.lastName,
    phone: phoneForCrm(contact.phone) ?? '',
    streetAddress: mailing.streetAddress ?? '',
    apartment: mailing.apartment ?? '',
    city: mailing.city ?? '',
    state: mailing.state ?? '',
    zipCode: mailing.zipCode ?? '',
  };
}

function parsePlace(value: unknown): HubPlace | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = textOrNull(row.id, 40);
  const kind = row.kind;
  const name = textOrNull(row.name, 120);
  if (!id || !name || typeof kind !== 'string' || !PLACE_KINDS.includes(kind as HubPlaceKind)) return null;
  return {
    id,
    kind: kind as HubPlaceKind,
    name,
    street: textOrNull(row.street, 160),
    city: textOrNull(row.city, 80),
    state: textOrNull(row.state, 40),
    zipCode: textOrNull(row.zip_code, 20),
  };
}

/** Read the service-role lookup payload. Returns null when no account matched. */
export function parseHubContact(data: unknown): HubContact | null {
  const value = typeof data === 'string' ? JSON.parse(data) as unknown : data;
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Unexpected hub lookup result');
  }
  const row = value as Record<string, unknown>;
  const userId = textOrNull(row.user_id, 40);
  const email = textOrNull(row.email, 320)?.toLowerCase() ?? '';
  if (!userId || !email.includes('@')) {
    throw new Error('Unexpected hub lookup result');
  }
  const places = Array.isArray(row.places)
    ? row.places.map(parsePlace).filter((place): place is HubPlace => place !== null)
    : [];
  return {
    userId,
    email,
    firstName: textOrNull(row.first_name, 80),
    lastName: textOrNull(row.last_name, 80),
    phone: textOrNull(row.phone, 40),
    streetAddress: textOrNull(row.street_address, 160),
    apartment: textOrNull(row.apartment, 40),
    city: textOrNull(row.city, 80),
    state: textOrNull(row.state, 40),
    zipCode: textOrNull(row.zip_code, 20),
    places,
  };
}

export interface VisitAddressInput {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface VisitAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  note: string;
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** A home visit needs a street, city, state, and ZIP. The note is optional. */
export function readVisitAddress(body: {
  visitStreet?: unknown;
  visitCity?: unknown;
  visitState?: unknown;
  visitZip?: unknown;
  visitNote?: unknown;
}): { ok: true; visit: VisitAddress } | { ok: false; error: string } {
  const visit = {
    street: clip(body.visitStreet, 120),
    city: clip(body.visitCity, 80),
    state: clip(body.visitState, 40),
    zip: clip(body.visitZip, 12),
    note: clip(body.visitNote, 500),
  };
  if (visit.street.length < 3 || visit.city.length < 2 || visit.state.length < 2 || visit.zip.length < 5) {
    return { ok: false, error: 'A street, city, state, and ZIP are required for the visit.' };
  }
  return { ok: true, visit };
}

export function formatVisitAddress(parts: VisitAddressInput): string {
  const street = parts.street?.trim() ?? '';
  const cityLine = [parts.city, parts.state].map((part) => part?.trim() ?? '').filter(Boolean).join(', ');
  const zip = parts.zip?.trim() ?? '';
  const locality = [cityLine, zip].filter(Boolean).join(' ');
  return [street, locality].filter(Boolean).join(', ');
}

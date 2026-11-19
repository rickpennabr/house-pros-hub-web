import { joinMailLine } from '@/lib/address/unit';
import { cleanText } from '@/lib/places/session';
import type { ProPropertyInput } from '@/lib/places/contact-places';

const KINDS = ['house', 'business', 'building'] as const;

/** Read a property the pro typed (nickname, type, address). Returns an error message when invalid. */
export function readProPropertyInput(body: unknown): { ok: true; input: ProPropertyInput } | { ok: false; error: string } {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = cleanText(raw.name, 120);
  const street = joinMailLine(cleanText(raw.street, 120), cleanText(raw.unit, 40)).slice(0, 160);
  if (!name) return { ok: false, error: 'Give the property a nickname.' };
  if (!street) return { ok: false, error: 'Enter the street address.' };
  const kind = KINDS.includes(raw.kind as (typeof KINDS)[number]) ? (raw.kind as ProPropertyInput['kind']) : 'house';
  return {
    ok: true,
    input: {
      name,
      kind,
      street,
      city: cleanText(raw.city, 80) || null,
      state: cleanText(raw.state, 40) || null,
      zipCode: cleanText(raw.zipCode, 20) || null,
    },
  };
}

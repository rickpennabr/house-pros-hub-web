import type { LinkItem } from '@/components/proscard/ProLinks';
import { isLinkType } from '@/lib/constants/linkTypes';

interface RawLinkLike {
  type?: unknown;
  url?: unknown;
  value?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toOptionalNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalizes incoming "links" data (from forms/storage/APIs) into strict `LinkItem[]`.
 * - Drops entries with invalid `type`
 * - Converts empty strings to `undefined`
 */
export function normalizeLinks(input: unknown): LinkItem[] {
  if (!Array.isArray(input)) return [];

  const out: LinkItem[] = [];
  for (const item of input) {
    if (!isRecord(item)) continue;

    const raw = item as RawLinkLike;
    if (!isLinkType(raw.type)) continue;

    out.push({
      type: raw.type,
      url: toOptionalNonEmptyString(raw.url),
      value: toOptionalNonEmptyString(raw.value),
    });
  }

  return out;
}



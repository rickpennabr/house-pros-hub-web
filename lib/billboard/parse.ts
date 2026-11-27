import { billboardSlideSchema } from '@/lib/schemas/proBillboard';
import { BillboardError } from '@/lib/billboard/db';
import type { BillboardSlideInput } from '@/lib/billboard/types';
import { sanitizeText, sanitizeUrl } from '@/lib/utils/sanitize';

function textOrNull(value: unknown): string | null | unknown {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return value;
  return sanitizeText(value) || null;
}

function dayOrNull(value: unknown): unknown {
  if (value == null || value === '') return null;
  return value;
}

/** Turn a request body into a slide. Throws BillboardError with a stable code. */
export function parseBillboardInput(raw: unknown): BillboardSlideInput {
  if (!raw || typeof raw !== 'object') throw new BillboardError('invalid', 400);
  const body = raw as Record<string, unknown>;
  const ctaRaw = typeof body.ctaUrl === 'string' ? body.ctaUrl.trim() : '';
  let ctaUrl: string | null = null;
  if (ctaRaw) {
    ctaUrl = sanitizeUrl(ctaRaw) || null;
    if (!ctaUrl) throw new BillboardError('link_invalid', 400);
  }

  const parsed = billboardSlideSchema.safeParse({
    kind: body.kind,
    mediaUrl: typeof body.mediaUrl === 'string' ? body.mediaUrl.trim() || null : (body.mediaUrl ?? null),
    headline: textOrNull(body.headline),
    body: textOrNull(body.body),
    badge: textOrNull(body.badge),
    ctaLabel: textOrNull(body.ctaLabel),
    ctaUrl,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
    durationSeconds: typeof body.durationSeconds === 'number' ? body.durationSeconds : undefined,
    startsOn: dayOrNull(body.startsOn),
    endsOn: dayOrNull(body.endsOn),
  });

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === 'startsOn' || field === 'endsOn') throw new BillboardError('dates_invalid', 400);
    throw new BillboardError('invalid', 400);
  }
  return parsed.data;
}

import { NextRequest, NextResponse } from 'next/server';
import { requirePortalUser, deny } from '@/lib/places/session';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { validateFileMagicBytes } from '@/lib/utils/fileValidation';
import { identifyPlant, plantIdConfigured } from '@/lib/ai/plant-id';

/** Vision models can take a while; allow Gemini then the fallback. */
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/ai/identify-plant (multipart: "file" image, optional "hint", "locale")
 * Any signed-in user: pros in ProCam and the Plants panel, homeowners in ProBot.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requirePortalUser();
    if (error || !user) return deny(error);
    const limited = await checkRateLimit(request, 'agent', user.id);
    if (limited) return limited;
    if (!plantIdConfigured()) return NextResponse.json({ error: 'Plant ID is not set up yet.' }, { status: 503 });

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Add a photo of the plant.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Photo must be 8 MB or less.' }, { status: 400 });
    const image = Buffer.from(await file.arrayBuffer());
    const check = await validateFileMagicBytes(image);
    if (!check.isValid || !check.mimeType) {
      return NextResponse.json({ error: 'Use a JPEG, PNG or WebP photo.' }, { status: 400 });
    }

    const hint = typeof form.get('hint') === 'string' ? String(form.get('hint')) : '';
    const locale = typeof form.get('locale') === 'string' ? String(form.get('locale')) : 'en';
    const result = await identifyPlant({ image, mimeType: check.mimeType, hint, locale });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not identify the plant.';
    console.error('POST /api/ai/identify-plant', err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

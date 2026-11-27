import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveBusiness } from '@/lib/booking/catalogAccess';
import { BILLBOARD_BUCKET } from '@/lib/billboard/types';
import { checkCsrfToken } from '@/lib/middleware/csrf';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  getExtensionFromMimeType,
  validateBillboardMedia,
  validateFileSize,
} from '@/lib/utils/fileValidation';

/**
 * POST /api/storage/upload-pro-billboard
 * Owner uploads a billboard photo (JPEG, PNG, WebP, 5MB) or video (MP4, WebM, MOV, 25MB).
 * Form fields: file, businessId. Header: X-CSRF-Token.
 * Response: { url, kind }
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(request, 'upload');
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await request.formData();
    const file = formData.get('file');
    const businessId = formData.get('businessId');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'media_required' }, { status: 400 });
    }
    if (typeof businessId !== 'string' || !businessId) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: 'forbidden' }, { status: 401 });

    const userRateLimit = await checkRateLimit(request, 'upload', auth.user.id);
    if (userRateLimit) return userRateLimit;

    const csrfResponse = await checkCsrfToken(request, auth.user.id);
    if (csrfResponse) return csrfResponse;

    const business = await resolveBusiness(businessId);
    if (!business || business.owner_id !== auth.user.id) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = await validateBillboardMedia(buffer);
    if (!sniffed.isValid || !sniffed.mimeType || !sniffed.kind) {
      return NextResponse.json({ error: 'media_invalid' }, { status: 400 });
    }
    const sizeKind = sniffed.kind === 'video' ? 'billboardVideo' : 'billboardImage';
    if (!validateFileSize(file.size, sizeKind)) {
      return NextResponse.json({ error: sniffed.kind === 'video' ? 'video_too_big' : 'image_too_big' }, { status: 400 });
    }

    const filePath = `${business.id}/${randomUUID()}${getExtensionFromMimeType(sniffed.mimeType)}`;
    const storage = createServiceRoleClient();
    const { data, error } = await storage.storage.from(BILLBOARD_BUCKET).upload(filePath, buffer, {
      contentType: sniffed.mimeType,
      cacheControl: '3600',
      upsert: false,
    });
    if (error || !data) {
      console.error('Pro Billboard upload', error);
      return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
    }

    const { data: pub } = storage.storage.from(BILLBOARD_BUCKET).getPublicUrl(data.path);
    return NextResponse.json({ url: pub.publicUrl, kind: sniffed.kind });
  } catch (error) {
    console.error('POST /api/storage/upload-pro-billboard', error);
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }
}

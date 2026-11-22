import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/blog/admin';
import { CRM_CATALOG_BUCKET } from '@/lib/crm/catalog-db';
import { getExtensionFromMimeType, validateFileMagicBytes } from '@/lib/utils/fileValidation';
import { isTradeSlug } from '@/lib/protrades/trades';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/admin/protrades/upload (multipart: file, trade)
 * Photo for a ProTrades database item. Stored in the public catalog bucket under hub-catalog/.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const form = await request.formData();
  const file = form.get('file');
  const trade = form.get('trade');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!isTradeSlug(trade)) return NextResponse.json({ error: 'Unknown trade' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const check = await validateFileMagicBytes(buffer);
  if (!check.isValid || !check.mimeType) return NextResponse.json({ error: 'Use a JPEG, PNG or WebP image.' }, { status: 400 });

  const path = `hub-catalog/${trade}/${crypto.randomUUID()}${getExtensionFromMimeType(check.mimeType)}`;
  const service = createServiceRoleClient();
  const uploaded = await service.storage.from(CRM_CATALOG_BUCKET).upload(path, buffer, {
    contentType: check.mimeType,
    cacheControl: '31536000',
  });
  if (uploaded.error) {
    console.error('POST /api/admin/protrades/upload', uploaded.error);
    return NextResponse.json({ error: 'Could not upload the photo' }, { status: 500 });
  }
  return NextResponse.json({ image_url: service.storage.from(CRM_CATALOG_BUCKET).getPublicUrl(path).data.publicUrl });
}

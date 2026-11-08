import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { CRM_CATALOG_BUCKET } from '@/lib/crm/catalog-db';
import { getExtensionFromMimeType, validateFileMagicBytes } from '@/lib/utils/fileValidation';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/crm/catalog/images
 * Upload one service or product photo. The caller sends folder=services or folder=products.
 */
export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireContractor();
  if (authError || !user) return authError;

  const formData = await request.formData();
  const file = formData.get('file');
  const folder = formData.get('folder') === 'products' ? 'products' : 'services';
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 5MB or smaller.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateFileMagicBytes(buffer);
  if (!validation.isValid || !validation.mimeType) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP image.' }, { status: 400 });
  }

  const extension = getExtensionFromMimeType(validation.mimeType);
  const storagePath = `${user.id}/${folder}/${crypto.randomUUID()}${extension}`;
  const service = createServiceRoleClient();
  const uploaded = await service.storage.from(CRM_CATALOG_BUCKET).upload(storagePath, buffer, {
    contentType: validation.mimeType,
    cacheControl: '3600',
  });
  if (uploaded.error) {
    console.error('POST /api/crm/catalog/images', uploaded.error);
    const missingBucket = /bucket not found/i.test(uploaded.error.message);
    return NextResponse.json(
      {
        error: missingBucket
          ? 'Photo storage is not ready. Apply supabase/migrations/101_crm_services_and_products.sql.'
          : 'Failed to upload the photo',
      },
      { status: missingBucket ? 503 : 500 }
    );
  }

  const { data } = service.storage.from(CRM_CATALOG_BUCKET).getPublicUrl(storagePath);
  return NextResponse.json({ image_url: data.publicUrl, storage_path: storagePath });
}

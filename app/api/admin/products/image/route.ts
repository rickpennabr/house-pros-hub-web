import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireProductsAdmin } from '@/lib/products/admin';
import { getExtensionFromMimeType, validateFileMagicBytes } from '@/lib/utils/fileValidation';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/admin/products/image
 * Upload a product photo to the House Pros storage bucket. Admin only.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireProductsAdmin();
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get('file');
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
  const path = `${crypto.randomUUID()}${extension}`;
  const service = createServiceRoleClient();
  const uploaded = await service.storage.from('pro-product-images').upload(path, buffer, {
    contentType: validation.mimeType,
    cacheControl: '3600',
  });

  if (uploaded.error) {
    console.error('POST /api/admin/products/image', uploaded.error);
    const missingBucket = /bucket not found/i.test(uploaded.error.message);
    return NextResponse.json(
      {
        error: missingBucket
          ? 'Product photo storage is not ready. Apply supabase/migrations/085_pro_products.sql in the House Pros Hub database.'
          : 'Failed to upload the photo',
      },
      { status: missingBucket ? 503 : 500 }
    );
  }

  const { data } = service.storage.from('pro-product-images').getPublicUrl(path);
  return NextResponse.json({ image_url: data.publicUrl });
}

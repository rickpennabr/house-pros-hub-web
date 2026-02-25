import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { validateFileMagicBytes, validateFileSize, getExtensionFromMimeType } from '@/lib/utils/fileValidation';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/storage/upload-estimate-image
 * Upload project image for estimate to Supabase Storage
 * Note: Estimates can be submitted anonymously, so this endpoint allows unauthenticated uploads
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // Check rate limit (per-user when authenticated, per-IP otherwise; same quota for chat + estimate form)
    const rateLimitResponse = await checkRateLimit(request, 'estimateUpload', user?.id);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max for estimate images)
    if (!validateFileSize(file.size, 'profile')) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Read file into buffer for magic bytes validation
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Validate file content using magic bytes (more secure than MIME type)
    const fileValidation = await validateFileMagicBytes(buffer);
    if (!fileValidation.isValid || !fileValidation.mimeType) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      );
    }

    // Generate unique file path using timestamp and random string
    // Format: estimates/timestamp-random.ext
    const fileExt = getExtensionFromMimeType(fileValidation.mimeType);
    const randomString = Math.random().toString(36).substring(2, 15);
    const filePath = `estimates/${Date.now()}-${randomString}${fileExt}`;

    const { data, error } = await supabase.storage
      .from('estimate-images')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileValidation.mimeType,
      });

    if (error) {
      logger.error('Error uploading estimate image', { endpoint: '/api/storage/upload-estimate-image' }, error as Error);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('estimate-images')
      .getPublicUrl(data.path);

    return NextResponse.json(
      { url: publicUrl, path: data.path },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error in POST /api/storage/upload-estimate-image', { endpoint: '/api/storage/upload-estimate-image' }, error as Error);
    return handleError(error, { endpoint: '/api/storage/upload-estimate-image' });
  }
}


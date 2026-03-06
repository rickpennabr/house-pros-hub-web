import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { validateFileMagicBytes, validateFileSize, getExtensionFromMimeType } from '@/lib/utils/fileValidation';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/storage/upload-business-image
 * Upload one gallery image to Supabase Storage (business-images bucket).
 * Returns the public URL for appending to business.images.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(request, 'upload');
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const businessId = formData.get('businessId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    if (!validateFileSize(file.size, 'gallery')) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileValidation = await validateFileMagicBytes(buffer);
    if (!fileValidation.isValid || !fileValidation.mimeType) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRateLimitResponse = await checkRateLimit(request, 'upload', user.id);
    if (userRateLimitResponse) return userRateLimitResponse;

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('owner_id')
      .eq('id', businessId)
      .single();

    if (businessError || !business || business.owner_id !== user.id) {
      if (businessError?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Unauthorized - you do not own this business' }, { status: 403 });
    }

    const fileExt = getExtensionFromMimeType(fileValidation.mimeType);
    const filePath = `${businessId}/gallery-${Date.now()}${fileExt}`;

    const { data, error } = await supabase.storage
      .from('business-images')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileValidation.mimeType,
      });

    if (error) {
      logger.error('Error uploading business gallery image', {
        endpoint: '/api/storage/upload-business-image',
        businessId,
        errorMessage: error.message,
      }, error as Error);
      return NextResponse.json(
        { error: error.message || 'Failed to upload image' },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('business-images')
      .getPublicUrl(data.path);

    return NextResponse.json({ url: publicUrl, path: data.path }, { status: 200 });
  } catch (error) {
    logger.error('Error in POST /api/storage/upload-business-image', { endpoint: '/api/storage/upload-business-image' }, error as Error);
    return handleError(error, { endpoint: '/api/storage/upload-business-image' });
  }
}

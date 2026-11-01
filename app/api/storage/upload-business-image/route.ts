import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { validateFileMagicBytes, validateFileSize, getExtensionFromMimeType } from '@/lib/utils/fileValidation';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/storage/upload-business-image
 * Upload one gallery image to Supabase Storage (business-images bucket).
 * Mirrors upload-business-background: rate limit, auth, ownership (or admin), then storage.
 * Returns the public URL for appending to business.images.
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit for upload endpoints (same as background)
    const rateLimitResponse = await checkRateLimit(request, 'upload');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const businessId = formData.get('businessId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // Validate file size first (before reading into buffer) - same pattern as background
    if (!validateFileSize(file.size, 'gallery')) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Read file into buffer for magic bytes validation
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Gallery-specific rate limit (20/hour) so multiple images can be added
    const userRateLimitResponse = await checkRateLimit(request, 'businessGalleryUpload', user.id);
    if (userRateLimitResponse) {
      return userRateLimitResponse;
    }

    const isAdmin = user.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

    if (!isAdmin) {
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .single();

      if (businessError) {
        logger.error('Error fetching business for ownership verification', {
          endpoint: '/api/storage/upload-business-image',
          businessId,
          error: businessError.message,
          code: businessError.code,
        });
        if (businessError.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Business not found. Please refresh the page and try again.' },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: 'Failed to verify business ownership' },
          { status: 500 }
        );
      }
      if (!business || business.owner_id !== user.id) {
        logger.warn('Unauthorized gallery upload attempt', {
          endpoint: '/api/storage/upload-business-image',
          businessId,
          businessOwnerId: business?.owner_id,
          userId: user.id,
        });
        return NextResponse.json(
          { error: 'Unauthorized - you do not own this business' },
          { status: 403 }
        );
      }
    }

    const fileExt = getExtensionFromMimeType(fileValidation.mimeType);
    const filePath = `${businessId}/gallery-${Date.now()}${fileExt}`;

    // Use service role for storage (same as background when admin); we already verified ownership above
    const storageClient = createServiceRoleClient();
    const { data, error } = await storageClient.storage
      .from('business-images')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: fileValidation.mimeType,
      });

    if (error) {
      logger.error('Error uploading business gallery image', {
        endpoint: '/api/storage/upload-business-image',
        businessId,
        errorMessage: error.message,
      }, error as Error);

      const msg = error.message ?? '';
      let errorMessage = 'Failed to upload image';
      if (msg.includes('duplicate') || msg.includes('already exists')) {
        errorMessage = 'A file with this name already exists. Please try again.';
      } else if (msg.includes('permission') || msg.includes('policy') || msg.includes('row-level security')) {
        errorMessage = 'Permission denied. Please check your account permissions.';
      } else if (msg.includes('Bucket') || msg.includes('bucket') || msg.includes('not found') || msg.includes('does not exist')) {
        errorMessage = 'Gallery storage bucket is missing. Run migration 059 (create business-images bucket) in Supabase, then try again.';
      }

      return NextResponse.json(
        { error: errorMessage, details: msg },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = storageClient.storage
      .from('business-images')
      .getPublicUrl(data.path);

    return NextResponse.json(
      { url: publicUrl, path: data.path },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error in POST /api/storage/upload-business-image', { endpoint: '/api/storage/upload-business-image' }, error as Error);
    return handleError(error, { endpoint: '/api/storage/upload-business-image' });
  }
}

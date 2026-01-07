import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { validateFileMagicBytes, validateFileSize, getExtensionFromMimeType } from '@/lib/utils/fileValidation';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/storage/upload-business-logo
 * Upload business logo to Supabase Storage
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit for upload endpoints
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

    // Validate file size first (before reading into buffer)
    if (!validateFileSize(file.size, 'logo')) {
      return NextResponse.json(
        { error: 'File size must be less than 2MB' },
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

    const supabase = await createClient();

    // Verify user is authenticated and owns the business
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check rate limit with user ID
    const userRateLimitResponse = await checkRateLimit(request, 'upload', user.id);
    if (userRateLimitResponse) {
      return userRateLimitResponse;
    }

    // Verify business ownership
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('owner_id')
      .eq('id', businessId)
      .single();

    if (businessError) {
      logger.error('Error fetching business for ownership verification', { 
        endpoint: '/api/storage/upload-business-logo',
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
      logger.warn('Unauthorized logo upload attempt', {
        endpoint: '/api/storage/upload-business-logo',
        businessId,
        businessOwnerId: business?.owner_id,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Unauthorized - you do not own this business' },
        { status: 403 }
      );
    }

    // Upload file to storage using validated buffer and MIME type
    // Path should be relative to bucket root (bucket is specified in .from())
    // Format: businessId/logo-timestamp.ext (same pattern as profile pictures: userId/timestamp.ext)
    const fileExt = getExtensionFromMimeType(fileValidation.mimeType);
    const filePath = `${businessId}/logo-${Date.now()}${fileExt}`;

    const { data, error } = await supabase.storage
      .from('business-logos')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileValidation.mimeType,
      });

    if (error) {
      logger.error('Error uploading business logo', { 
        endpoint: '/api/storage/upload-business-logo',
        businessId,
        errorMessage: error.message,
      }, error as Error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to upload image';
      if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
        errorMessage = 'A file with this name already exists. Please try again.';
      } else if (error.message?.includes('permission') || error.message?.includes('policy')) {
        errorMessage = 'Permission denied. Please check your account permissions.';
      } else if (error.message?.includes('bucket')) {
        errorMessage = 'Storage bucket error. Please contact support.';
      }
      
      return NextResponse.json(
        { error: errorMessage, details: error.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('business-logos')
      .getPublicUrl(data.path);

    return NextResponse.json(
      { url: publicUrl, path: data.path },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error in POST /api/storage/upload-business-logo', { endpoint: '/api/storage/upload-business-logo' }, error as Error);
    return handleError(error, { endpoint: '/api/storage/upload-business-logo' });
  }
}


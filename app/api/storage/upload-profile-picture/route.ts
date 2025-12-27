import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { validateFileMagicBytes, validateFileSize, getExtensionFromMimeType } from '@/lib/utils/fileValidation';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/storage/upload-profile-picture
 * Upload profile picture to Supabase Storage
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
    const userId = formData.get('userId') as string;

    // Check rate limit with user ID if available
    if (userId) {
      const userRateLimitResponse = await checkRateLimit(request, 'upload', userId);
      if (userRateLimitResponse) {
        return userRateLimitResponse;
      }
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate file size first (before reading into buffer)
    if (!validateFileSize(file.size, 'profile')) {
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

    // Verify user is authenticated and matches userId
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Upload file to storage using validated buffer and MIME type
    // Path should be relative to bucket root (bucket is specified in .from())
    // Format: userId/timestamp.ext
    const fileExt = getExtensionFromMimeType(fileValidation.mimeType);
    const filePath = `${userId}/${Date.now()}${fileExt}`;

    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileValidation.mimeType,
      });

    if (error) {
      logger.error('Error uploading profile picture', { endpoint: '/api/storage/upload-profile-picture' }, error as Error);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(data.path);

    return NextResponse.json(
      { url: publicUrl, path: data.path },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error in POST /api/storage/upload-profile-picture', { endpoint: '/api/storage/upload-profile-picture' }, error as Error);
    return handleError(error, { endpoint: '/api/storage/upload-profile-picture' });
  }
}


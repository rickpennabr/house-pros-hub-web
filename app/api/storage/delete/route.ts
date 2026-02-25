import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import {
  validateStorageBucket,
  validateStoragePath,
  normalizeStoragePath,
} from '@/lib/utils/storageValidation';

/**
 * DELETE /api/storage/delete
 * Delete a file from Supabase Storage
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket');
    const path = searchParams.get('path');

    if (!bucket || !path) {
      return NextResponse.json(
        { error: 'Bucket and path are required' },
        { status: 400 }
      );
    }

    const bucketError = validateStorageBucket(bucket);
    if (bucketError) {
      return NextResponse.json({ error: bucketError }, { status: 400 });
    }
    const pathError = validateStoragePath(path);
    if (pathError) {
      return NextResponse.json({ error: pathError }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is admin
    const userEmail = user.email?.toLowerCase().trim();
    if (userEmail !== ADMIN_EMAIL.toLowerCase().trim()) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Extract path from URL if full URL is provided, then normalize
    let filePath = path;
    if (path.includes(bucket)) {
      const urlParts = path.split(`${bucket}/`);
      filePath = urlParts[1] || path;
    }
    filePath = normalizeStoragePath(filePath);
    if (!filePath) {
      return NextResponse.json(
        { error: 'Path is required after normalization' },
        { status: 400 }
      );
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      logger.error(`Error deleting file from ${bucket}`, { endpoint: '/api/storage/delete', bucket }, error as Error);
      return NextResponse.json(
        { error: 'Failed to delete file' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error in DELETE /api/storage/delete', { endpoint: '/api/storage/delete' }, error as Error);
    return handleError(error, { endpoint: '/api/storage/delete' });
  }
}


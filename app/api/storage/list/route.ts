import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * GET /api/storage/list
 * List files in a Supabase Storage bucket
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket');
    const folder = searchParams.get('folder') || '';

    if (!bucket) {
      return NextResponse.json(
        { error: 'Bucket name is required' },
        { status: 400 }
      );
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

    // List files in the bucket
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      logger.error(`Error listing files from ${bucket}`, { endpoint: '/api/storage/list', bucket }, error as Error);
      return NextResponse.json(
        { error: 'Failed to list files' },
        { status: 500 }
      );
    }

    // Filter out folders (items without an id are folders in Supabase)
    const files = (data || []).filter(item => item.id);

    // Get public URLs for all files
    const filesWithUrls = files.map(file => {
      const filePath = folder ? `${folder}/${file.name}` : file.name;
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return {
        ...file,
        path: filePath,
        publicUrl,
        size: file.metadata?.size || 0,
        mimeType: file.metadata?.mimetype || 'unknown'
      };
    });

    return NextResponse.json(
      { files: filesWithUrls },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error in GET /api/storage/list', { endpoint: '/api/storage/list' }, error as Error);
    return handleError(error, { endpoint: '/api/storage/list' });
  }
}

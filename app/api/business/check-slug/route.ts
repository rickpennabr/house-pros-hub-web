import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/business/check-slug?slug=the-paver-pro
 * Checks if a business slug is available
 */
async function handleCheckSlug(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug parameter is required' },
        { status: 400 }
      );
    }

    // Validate slug format
    if (slug.length < 3) {
      return NextResponse.json(
        { available: false, error: 'Slug must be at least 3 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { available: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if slug exists in database
    const { data: existingBusiness, error } = await supabase
      .from('businesses')
      .select('id, slug')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      logger.error('Error checking slug availability', { endpoint: '/api/business/check-slug', slug }, error as Error);
      return handleError(error, { endpoint: '/api/business/check-slug' });
    }

    const available = !existingBusiness;

    return NextResponse.json({
      available,
      slug,
    });
  } catch (error) {
    logger.error('Error in GET /api/business/check-slug', { endpoint: '/api/business/check-slug' }, error as Error);
    return handleError(error, { endpoint: '/api/business/check-slug' });
  }
}

export async function GET(request: NextRequest) {
  return requireAuth(handleCheckSlug)(request);
}


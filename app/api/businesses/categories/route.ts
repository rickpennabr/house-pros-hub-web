import { NextRequest, NextResponse } from 'next/server';
import { getCachedDirectoryCategories } from '@/lib/data/businessDirectory';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { logger } from '@/lib/utils/logger';
import { handleError } from '@/lib/utils/errorHandler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/businesses/categories
 * Category labels that currently have an active business, in directory order.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(request, 'general');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const categories = await getCachedDirectoryCategories();
    return NextResponse.json(
      { categories },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    logger.error(
      'Error in GET /api/businesses/categories',
      { endpoint: '/api/businesses/categories' },
      error as Error
    );
    return handleError(error, { endpoint: '/api/businesses/categories' });
  }
}

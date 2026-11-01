import { NextRequest, NextResponse } from 'next/server';
import {
  clampDirectoryPage,
  getBusinessDirectoryPage,
  sanitizeDirectoryCategory,
  sanitizeDirectoryCity,
  sanitizeDirectorySearch,
  searchBusinessesForAgents,
} from '@/lib/data/businessDirectory';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { logger } from '@/lib/utils/logger';
import { handleError } from '@/lib/utils/errorHandler';
import { DIRECTORY_CARD_PAGE_SIZE } from '@/lib/constants/businessDirectory';

export const dynamic = 'force-dynamic';

/**
 * GET /api/businesses
 * One page of active businesses for the public directory.
 * Search and category are applied in the database before the page is cut.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(request, 'general');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get('limit') || String(DIRECTORY_CARD_PAGE_SIZE), 10);
    const requestedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const { limit, offset } = clampDirectoryPage(requestedLimit, requestedOffset);
    const search = sanitizeDirectorySearch(searchParams.get('search'));
    const category = sanitizeDirectoryCategory(searchParams.get('category'));
    const city = sanitizeDirectoryCity(searchParams.get('city'));

    const page = city
      ? await searchBusinessesForAgents({ limit, offset, search, category, city })
      : await getBusinessDirectoryPage({
          limit,
          offset,
          search,
          category,
        });

    const filtered = Boolean(search || category || city);

    return NextResponse.json(
      {
        businesses: page.businesses,
        pagination: {
          limit,
          offset,
          count: page.businesses.length,
          total: page.total,
          hasMore: offset + page.businesses.length < page.total,
        },
      },
      {
        headers: {
          'Cache-Control': filtered
            ? 'public, s-maxage=30, stale-while-revalidate=60'
            : 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    logger.error('Error in GET /api/businesses', { endpoint: '/api/businesses' }, error as Error);
    return handleError(error, { endpoint: '/api/businesses' });
  }
}

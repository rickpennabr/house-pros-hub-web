import { NextRequest, NextResponse } from 'next/server';
import { requireAgentApp } from '@/lib/agent/auth';
import { AGENT_RULE, siteOrigin } from '@/lib/agent/constants';
import { presentPro } from '@/lib/agent/present';
import {
  clampDirectoryPage,
  searchBusinessesForAgents,
  sanitizeDirectoryCategory,
  sanitizeDirectoryCity,
  sanitizeDirectorySearch,
} from '@/lib/data/businessDirectory';
import { DIRECTORY_CARD_PAGE_SIZE } from '@/lib/constants/businessDirectory';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/v1/pros
 * Search active pros for an agent app. Bearer key required.
 * Query: search, category, city, limit, offset.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAgentApp(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get('limit') || String(DIRECTORY_CARD_PAGE_SIZE), 10);
    const requestedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const { limit, offset } = clampDirectoryPage(requestedLimit, requestedOffset);
    const page = await searchBusinessesForAgents({
      limit,
      offset,
      search: sanitizeDirectorySearch(searchParams.get('search')),
      category: sanitizeDirectoryCategory(searchParams.get('category')),
      city: sanitizeDirectoryCity(searchParams.get('city')),
    });
    const origin = siteOrigin(request);

    return NextResponse.json({
      pros: page.businesses.map((business) => presentPro(business, origin)),
      rules: AGENT_RULE,
      pagination: {
        limit,
        offset,
        count: page.businesses.length,
        total: page.total,
        hasMore: offset + page.businesses.length < page.total,
        cityMatchTruncated: page.cityMatchTruncated,
      },
    });
  } catch (error) {
    logger.error('GET /api/agent/v1/pros failed', { endpoint: '/api/agent/v1/pros' }, error as Error);
    return NextResponse.json({ error: 'Failed to search pros' }, { status: 500 });
  }
}

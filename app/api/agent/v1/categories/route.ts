import { NextRequest, NextResponse } from 'next/server';
import { requireAgentApp } from '@/lib/agent/auth';
import { AGENT_RULE } from '@/lib/agent/constants';
import { getCachedDirectoryCategories } from '@/lib/data/businessDirectory';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/v1/categories
 * Category labels that currently have an active pro. Bearer key required.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAgentApp(request);
  if (!auth.ok) return auth.response;

  try {
    const categories = await getCachedDirectoryCategories();
    return NextResponse.json({ categories, rules: AGENT_RULE });
  } catch (error) {
    logger.error(
      'GET /api/agent/v1/categories failed',
      { endpoint: '/api/agent/v1/categories' },
      error as Error
    );
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
  }
}

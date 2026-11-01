import { NextRequest, NextResponse } from 'next/server';
import { requireAgentApp } from '@/lib/agent/auth';
import { requestLocale } from '@/lib/agent/constants';
import { getAgentEstimate } from '@/lib/agent/estimates';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/v1/estimates/[id]
 * Status of an estimate this agent app created. Other apps receive 404.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAgentApp(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const result = await getAgentEstimate({
      app: auth.app,
      id,
      locale: requestLocale(request),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.error(
      'GET /api/agent/v1/estimates/[id] failed',
      { endpoint: '/api/agent/v1/estimates/[id]' },
      error as Error
    );
    return NextResponse.json({ error: 'Failed to load estimate' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAgentApp } from '@/lib/agent/auth';
import { AGENT_RULE, siteOrigin } from '@/lib/agent/constants';
import { presentPro } from '@/lib/agent/present';
import { getPublicBusiness } from '@/lib/data/businessDirectory';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/v1/pros/[id]
 * One active pro by id or slug. Bearer key required.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAgentApp(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const business = await getPublicBusiness(id);
    if (!business) {
      return NextResponse.json({ error: 'Pro not found' }, { status: 404 });
    }
    return NextResponse.json({
      pro: presentPro(business, siteOrigin(request)),
      rules: AGENT_RULE,
    });
  } catch (error) {
    logger.error('GET /api/agent/v1/pros/[id] failed', { endpoint: '/api/agent/v1/pros/[id]' }, error as Error);
    return NextResponse.json({ error: 'Failed to load pro' }, { status: 500 });
  }
}

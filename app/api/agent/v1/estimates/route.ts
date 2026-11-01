import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { requireAgentApp } from '@/lib/agent/auth';
import { readIdempotencyKey, requestLocale, validIdempotencyKey } from '@/lib/agent/constants';
import { createAgentEstimate } from '@/lib/agent/estimates';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/v1/estimates
 * Open an estimate request for a homeowner. Bearer key required.
 * Idempotency-Key header or body idempotencyKey. Header wins.
 * Response includes messageForUser, which the agent must show unchanged.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAgentApp(request);
  if (!auth.ok) return auth.response;

  const writeLimit = await checkRateLimit(request, 'agentWrite', auth.app.id);
  if (writeLimit) return writeLimit;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const headerKey = validIdempotencyKey(readIdempotencyKey(request));
    if (headerKey.error) {
      return NextResponse.json({ error: headerKey.error }, { status: 400 });
    }
    const bodyKey = validIdempotencyKey(
      typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : null
    );
    if (!headerKey.key && bodyKey.error) {
      return NextResponse.json({ error: bodyKey.error }, { status: 400 });
    }

    const result = await createAgentEstimate({
      app: auth.app,
      body,
      locale: requestLocale(request),
      idempotencyKey: headerKey.key ?? bodyKey.key,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    logger.error('POST /api/agent/v1/estimates failed', { endpoint: '/api/agent/v1/estimates' }, error as Error);
    return NextResponse.json({ error: 'Failed to save estimate' }, { status: 500 });
  }
}

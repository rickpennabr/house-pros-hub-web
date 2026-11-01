import { NextRequest, NextResponse } from 'next/server';
import { buildOpenApiDocument } from '@/lib/agent/openapi';
import { siteOrigin } from '@/lib/agent/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /api/openapi.json
 * OpenAPI 3.1 document for the agent API.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(buildOpenApiDocument(siteOrigin(request)), {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}

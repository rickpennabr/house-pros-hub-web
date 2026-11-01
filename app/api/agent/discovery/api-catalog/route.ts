import { NextRequest, NextResponse } from 'next/server';
import { siteOrigin } from '@/lib/agent/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /.well-known/api-catalog
 * RFC 9727 linkset for the agent OpenAPI document.
 */
export async function GET(request: NextRequest) {
  const origin = siteOrigin(request);
  return NextResponse.json(
    {
      linkset: [
        {
          anchor: `${origin}/`,
          'service-desc': [
            {
              href: `${origin}/api/openapi.json`,
              type: 'application/openapi+json',
            },
          ],
          status: [{ href: `${origin}/api/health` }],
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/linkset+json',
        'Cache-Control': 'public, max-age=300',
      },
    }
  );
}

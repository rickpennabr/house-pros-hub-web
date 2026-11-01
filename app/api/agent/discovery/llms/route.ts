import { NextRequest, NextResponse } from 'next/server';
import { AGENT_RULE, siteOrigin } from '@/lib/agent/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /llms.txt
 * Short map of House Pros Hub for agents. Rewritten from /llms.txt.
 */
export async function GET(request: NextRequest) {
  const origin = siteOrigin(request);
  const body = `# House Pros Hub

> House Pros Hub is a marketplace where homeowners find licensed home-service pros and ask for a free estimate. The pro prices the job. The marketplace does not quote a price or promise that a named pro will take the work.

${AGENT_RULE}

## For AI agents

- [OpenAPI](${origin}/api/openapi.json): search pros, read a pro, open an estimate, read that estimate. Bearer API key required.
- [MCP server](${origin}/api/mcp): same tools over MCP. Bearer API key required on tools/list and tools/call.
- [MCP server card](${origin}/.well-known/mcp/server-card.json): where the server lives and how to authenticate.
- [API catalog](${origin}/.well-known/api-catalog): linkset pointing at the OpenAPI document.

## What an agent may do

- Search active pros by trade, category, and city.
- Read a public profile, including the license numbers the pro listed.
- Open an estimate request with the homeowner's contact details, address, trade, budget range, and timeline.
- Show the messageForUser field to the homeowner unchanged.
- Retry with the same Idempotency-Key so a second request is not created.

## What an agent may not do

- Invent a price, a price per square foot, or a start date.
- Promise that a named pro will accept the job.
- Read another app's estimate requests.

## People

- [Directory](${origin}/en/businesslist): browse pros.
- [Estimate](${origin}/en/estimate): the same request a person can submit in the browser.
- [ProBot](${origin}/en/probot): the in-site assistant. It can search pros and prepare an estimate. The homeowner taps Confirm before a request is filed.

Checked: 2026-10-30.
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

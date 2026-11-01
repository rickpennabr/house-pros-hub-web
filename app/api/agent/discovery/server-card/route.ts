import { NextRequest, NextResponse } from 'next/server';
import { mcpServerCard } from '@/lib/agent/mcp';
import { siteOrigin } from '@/lib/agent/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /.well-known/mcp/server-card.json
 * Discovery card for the House Pros Hub MCP server.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(mcpServerCard(siteOrigin(request)), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}

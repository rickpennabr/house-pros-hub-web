import { NextRequest } from 'next/server';
import { handleMcpRequest } from '@/lib/agent/mcp';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mcp
 * Stateless MCP endpoint. initialize and ping are public.
 * tools/list and tools/call require Authorization: Bearer hph_…
 */
export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

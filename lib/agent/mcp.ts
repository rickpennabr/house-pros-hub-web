import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { requireAgentApp, type AgentApp } from '@/lib/agent/auth';
import { AGENT_RULE, requestLocale, siteOrigin, validIdempotencyKey } from '@/lib/agent/constants';
import { createAgentEstimate, getAgentEstimate } from '@/lib/agent/estimates';
import { AGENT_TOOLS, runDirectoryTool } from '@/lib/agent/tools';

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'House Pros Hub', version: '1.0.0' };

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: unknown; protocolVersion?: string };
}

const TOOLS = AGENT_TOOLS;

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toolResult(data: unknown, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
    isError,
  };
}

async function callTool(name: string, args: Record<string, unknown>, request: NextRequest, app: AgentApp) {
  const origin = siteOrigin(request);
  const locale = requestLocale(request);

  const directory = await runDirectoryTool(name, args, origin);
  if (directory) return toolResult(directory.data, directory.isError);

  if (name === 'create_estimate') {
    const writeLimit = await checkRateLimit(request, 'agentWrite', app.id);
    if (writeLimit) {
      const payload = await writeLimit.json().catch(() => ({ error: 'Agent estimate limit exceeded.' }));
      return toolResult(payload, true);
    }
    const idempotency = validIdempotencyKey(
      typeof args.idempotencyKey === 'string' ? args.idempotencyKey.trim() : null
    );
    if (idempotency.error) return toolResult({ error: idempotency.error }, true);
    const result = await createAgentEstimate({
      app,
      body: args,
      locale,
      idempotencyKey: idempotency.key,
    });
    return toolResult(result.body, !result.ok);
  }

  if (name === 'get_estimate') {
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    if (!id) return toolResult({ error: 'id is required' }, true);
    const result = await getAgentEstimate({ app, id, locale });
    return toolResult(result.body, !result.ok);
  }

  return null;
}

function rpcError(id: string | number | null | undefined, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function negotiatedProtocol(requested: string | undefined): string {
  if (requested && PROTOCOL_VERSIONS.includes(requested)) return requested;
  return '2025-03-26';
}

/**
 * Handle one MCP JSON-RPC request over stateless HTTP.
 * initialize is public. Tool calls require the agent API key.
 */
export async function handleMcpRequest(request: NextRequest): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'Parse error'), { status: 400 });
  }
  if (Array.isArray(payload) || !payload || typeof payload !== 'object') {
    return NextResponse.json(rpcError(null, -32600, 'Expected a single JSON-RPC object'), { status: 400 });
  }

  const message = payload as JsonRpcRequest;
  const method = message.method ?? '';
  const protocol = negotiatedProtocol(message.params?.protocolVersion);

  if (method.startsWith('notifications/')) {
    return new NextResponse(null, { status: 202, headers: { 'MCP-Protocol-Version': protocol } });
  }

  if (method === 'initialize') {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: message.id ?? null,
        result: {
          protocolVersion: protocol,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: AGENT_RULE,
        },
      },
      { headers: { 'MCP-Protocol-Version': protocol } }
    );
  }

  if (method === 'ping') {
    return NextResponse.json(
      { jsonrpc: '2.0', id: message.id ?? null, result: {} },
      { headers: { 'MCP-Protocol-Version': protocol } }
    );
  }

  const auth = await requireAgentApp(request);
  if (!auth.ok) return auth.response;

  if (method === 'tools/list') {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: message.id ?? null,
      result: { tools: TOOLS },
    });
  }

  if (method === 'tools/call') {
    const name = message.params?.name ?? '';
    const known = TOOLS.some((tool) => tool.name === name);
    if (!known) {
      return NextResponse.json(rpcError(message.id, -32602, `Unknown tool: ${name}`));
    }
    try {
      const result = await callTool(name, asRecord(message.params?.arguments), request, auth.app);
      return NextResponse.json({
        jsonrpc: '2.0',
        id: message.id ?? null,
        result,
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Tool failed';
      return NextResponse.json({
        jsonrpc: '2.0',
        id: message.id ?? null,
        result: toolResult({ error: text }, true),
      });
    }
  }

  return NextResponse.json(rpcError(message.id, -32601, `Method not found: ${method}`));
}

export function mcpServerCard(origin: string) {
  return {
    serverInfo: SERVER_INFO,
    description: AGENT_RULE,
    transport: {
      type: 'streamable-http',
      endpoint: `${origin}/api/mcp`,
    },
    capabilities: { tools: true },
    authentication: {
      schemes: [
        {
          type: 'bearer',
          header: 'Authorization',
          description: 'Bearer hph_… key created in the House Pros Hub admin under Agent apps.',
        },
      ],
    },
    tools: TOOLS.map((tool) => ({ name: tool.name, description: tool.description })),
  };
}

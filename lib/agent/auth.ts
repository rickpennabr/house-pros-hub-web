import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

export interface AgentApp {
  id: string;
  name: string;
}

export function hashAgentKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readBearer(request: NextRequest): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    {
      error: 'Agent API key is required',
      message: 'Send Authorization: Bearer hph_... An admin creates the key under Agent apps.',
    },
    {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer realm="House Pros Hub agents"' },
    }
  );
}

export function isMissingAgentStorage(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    message.includes('agent_apps') ||
    message.includes('idempotency_key') ||
    message.includes('agent_app_id')
  );
}

export function agentStorageNotReady(): NextResponse {
  return NextResponse.json(
    { error: 'Agent storage is not ready. Apply supabase/migrations/077_agent_apps.sql.' },
    { status: 503 }
  );
}

/**
 * Resolve a live agent app from Authorization: Bearer.
 * Failed keys share a per-IP limit. Live keys share a per-app limit.
 */
export async function requireAgentApp(
  request: NextRequest
): Promise<{ ok: true; app: AgentApp } | { ok: false; response: NextResponse }> {
  const token = readBearer(request);
  if (!token || !token.startsWith('hph_')) {
    const limited = await checkRateLimit(request, 'agentAuth');
    if (limited) return { ok: false, response: limited };
    return { ok: false, response: unauthorized() };
  }

  let app: AgentApp | null = null;
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('agent_apps')
      .select('id, name, revoked_at')
      .eq('key_hash', hashAgentKey(token))
      .maybeSingle();

    if (error) {
      if (isMissingAgentStorage(error)) {
        return { ok: false, response: agentStorageNotReady() };
      }
      return { ok: false, response: unauthorized() };
    }
    if (data && !data.revoked_at) {
      app = { id: data.id, name: data.name };
    }
  } catch {
    return { ok: false, response: unauthorized() };
  }

  if (!app) {
    const limited = await checkRateLimit(request, 'agentAuth');
    if (limited) return { ok: false, response: limited };
    return { ok: false, response: unauthorized() };
  }

  const limited = await checkRateLimit(request, 'agent', app.id);
  if (limited) return { ok: false, response: limited };
  return { ok: true, app };
}

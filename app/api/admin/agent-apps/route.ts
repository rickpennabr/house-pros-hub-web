import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { agentAppCreateSchema } from '@/lib/schemas/agentApp';
import { hashAgentKey, isMissingAgentStorage } from '@/lib/agent/auth';
import { logger } from '@/lib/utils/logger';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * GET /api/admin/agent-apps
 * List agent apps without their secrets. Admin only.
 */
export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('agent_apps')
    .select('id, name, key_prefix, created_at, revoked_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingAgentStorage(error)) {
      return NextResponse.json(
        { error: 'Agent storage is not ready. Apply supabase/migrations/077_agent_apps.sql.' },
        { status: 503 }
      );
    }
    logger.error('GET /api/admin/agent-apps failed', { endpoint: '/api/admin/agent-apps' }, error as Error);
    return NextResponse.json({ error: 'Failed to load agent apps' }, { status: 500 });
  }

  return NextResponse.json({ apps: data ?? [] });
}

/**
 * POST /api/admin/agent-apps
 * Create an agent app and return the API key once. Admin only.
 * Body: { name: string }
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const json = await request.json();
    const { name } = agentAppCreateSchema.parse(json);
    const apiKey = `hph_${randomBytes(32).toString('base64url')}`;
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('agent_apps')
      .insert({
        name,
        key_prefix: apiKey.slice(0, 12),
        key_hash: hashAgentKey(apiKey),
      })
      .select('id, name, key_prefix, created_at')
      .single();

    if (error || !data) {
      if (isMissingAgentStorage(error)) {
        return NextResponse.json(
          { error: 'Agent storage is not ready. Apply supabase/migrations/077_agent_apps.sql.' },
          { status: 503 }
        );
      }
      logger.error('POST /api/admin/agent-apps failed', { endpoint: '/api/admin/agent-apps' }, error as Error);
      return NextResponse.json({ error: 'Failed to create agent app' }, { status: 500 });
    }

    return NextResponse.json({
      app: data,
      apiKey,
      message: 'Copy this key now. It is not shown again.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    logger.error('POST /api/admin/agent-apps failed', { endpoint: '/api/admin/agent-apps' }, error as Error);
    return NextResponse.json({ error: 'Failed to create agent app' }, { status: 500 });
  }
}

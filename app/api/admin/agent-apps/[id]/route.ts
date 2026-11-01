import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { isMissingAgentStorage } from '@/lib/agent/auth';
import { logger } from '@/lib/utils/logger';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }) };
  }
  return { error: null };
}

/**
 * DELETE /api/admin/agent-apps/[id]
 * Revoke an agent app. Existing estimates stay. Admin only.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = await context.params;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('agent_apps')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    if (isMissingAgentStorage(error)) {
      return NextResponse.json(
        { error: 'Agent storage is not ready. Apply supabase/migrations/077_agent_apps.sql.' },
        { status: 503 }
      );
    }
    logger.error('DELETE /api/admin/agent-apps/[id] failed', { endpoint: '/api/admin/agent-apps/[id]' }, error as Error);
    return NextResponse.json({ error: 'Failed to revoke agent app' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Agent app not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

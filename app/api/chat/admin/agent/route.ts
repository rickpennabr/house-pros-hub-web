import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { adminAgentPauseSchema, adminConversationIdSchema } from '@/lib/schemas/chat';
import { agentStepLabel } from '@/lib/chat/proagent-policy';

async function requireAdmin() {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  const isAdmin = !!user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  return isAdmin;
}

/**
 * GET /api/chat/admin/agent?conversationId=
 * Pause flag and the tool steps for the open conversation.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const conversationId = request.nextUrl.searchParams.get('conversationId') ?? '';
  const parsed = adminConversationIdSchema.safeParse(conversationId);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: conversation } = await supabase
    .from('probot_conversations')
    .select('agent_paused_at')
    .eq('id', parsed.data)
    .maybeSingle();

  const { data: steps, error } = await supabase
    .from('probot_agent_steps')
    .select('id, message_id, tool_name, status, created_at')
    .eq('conversation_id', parsed.data)
    .order('created_at', { ascending: true })
    .limit(40);

  if (error) {
    return NextResponse.json({ paused: Boolean(conversation?.agent_paused_at), steps: [] });
  }

  return NextResponse.json({
    paused: Boolean(conversation?.agent_paused_at),
    steps: (steps ?? []).map((step) => ({
      id: step.id,
      messageId: step.message_id,
      toolName: step.tool_name,
      status: step.status,
      label: agentStepLabel(step.tool_name, step.status),
      created_at: step.created_at,
    })),
  });
}

/**
 * POST /api/chat/admin/agent
 * paused true takes the thread. paused false hands it back to ProAgent.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = adminAgentPauseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('probot_conversations')
    .update({ agent_paused_at: parsed.data.paused ? new Date().toISOString() : null })
    .eq('id', parsed.data.conversationId);
  if (error) {
    return NextResponse.json({ error: 'Could not update ProAgent' }, { status: 503 });
  }
  if (parsed.data.paused) {
    await supabase
      .from('probot_agent_steps')
      .update({ status: 'failed', output: { reason: 'superseded' } })
      .eq('conversation_id', parsed.data.conversationId)
      .eq('status', 'needs_confirm');
  }
  return NextResponse.json({ paused: parsed.data.paused });
}

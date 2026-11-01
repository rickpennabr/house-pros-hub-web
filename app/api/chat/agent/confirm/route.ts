import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { confirmAgentEstimateSchema } from '@/lib/schemas/chat';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ensureProAgentApp } from '@/lib/agent/proagent-app';
import { createAgentEstimate } from '@/lib/agent/estimates';
import { requestLocale } from '@/lib/agent/constants';
import type { Json } from '@/lib/types/supabase';

/**
 * POST /api/chat/agent/confirm
 * The homeowner taps Confirm. This is the only in-chat path that inserts an estimate.
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    const parsed = confirmAgentEstimateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const cookieDenied = visitorCookieDenied(request, parsed.data.visitorId);
    if (cookieDenied) return cookieDenied;

    const supabase = createServiceRoleClient();
    const { data: conversation } = await supabase
      .from('probot_conversations')
      .select('id')
      .eq('id', parsed.data.conversationId)
      .eq('visitor_id', parsed.data.visitorId)
      .maybeSingle();
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { data: step, error: stepError } = await supabase
      .from('probot_agent_steps')
      .select('id, status, input, conversation_id')
      .eq('id', parsed.data.stepId)
      .eq('conversation_id', parsed.data.conversationId)
      .maybeSingle();
    if (stepError) {
      return NextResponse.json({ error: 'Estimate draft is not ready' }, { status: 503 });
    }
    if (!step || step.status === 'failed') {
      return NextResponse.json({ error: 'This estimate draft is no longer available' }, { status: 409 });
    }

    const locale = parsed.data.locale ?? requestLocale(request);
    if (step.status === 'confirmed') {
      return NextResponse.json({ alreadyFiled: true }, { status: 200 });
    }
    if (step.status !== 'needs_confirm' || !step.input) {
      return NextResponse.json({ error: 'This estimate draft is no longer available' }, { status: 409 });
    }

    const app = await ensureProAgentApp();
    if (!app) {
      return NextResponse.json({ error: 'Estimate storage is not ready' }, { status: 503 });
    }

    const result = await createAgentEstimate({
      app,
      body: step.input,
      locale,
      idempotencyKey: step.id,
    });
    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    await supabase
      .from('probot_agent_steps')
      .update({
        status: 'confirmed',
        output: { estimateId: result.body.estimateId } as Json,
      })
      .eq('id', step.id);

    const { data: draftMessage } = await supabase
      .from('probot_messages')
      .select('id, payload')
      .eq('conversation_id', parsed.data.conversationId)
      .contains('payload', { confirm: { stepId: step.id } })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (draftMessage?.payload && typeof draftMessage.payload === 'object' && !Array.isArray(draftMessage.payload)) {
      const next = { ...(draftMessage.payload as Record<string, unknown>) };
      delete next.confirm;
      next.confirmed = true;
      await supabase.from('probot_messages').update({ payload: next as Json }).eq('id', draftMessage.id);
    }

    const { data: filed } = await supabase
      .from('probot_messages')
      .insert({
        conversation_id: parsed.data.conversationId,
        sender: 'admin',
        body: result.body.messageForUser,
        admin_sent_as: 'probot',
      })
      .select('id, conversation_id, sender, body, created_at')
      .single();

    return NextResponse.json({
      messageForUser: result.body.messageForUser,
      estimateId: result.body.estimateId,
      message: filed
        ? {
            id: filed.id,
            conversationId: filed.conversation_id,
            sender: 'admin' as const,
            body: filed.body,
            created_at: filed.created_at,
            admin_sent_as: 'probot' as const,
          }
        : undefined,
    });
  } catch (error) {
    console.error('ProAgent confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

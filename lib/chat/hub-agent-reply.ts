import type { Json } from '@/lib/types/supabase'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isMissingColumnError } from '@/lib/chat/probot-reply'
import { recordProbotTrace } from '@/lib/chat/probot-trace'
import { parseAgentPayload } from '@/lib/chat/proagent-policy'
import { runProAgentTurn, type AgentStepDraft } from '@/lib/chat/proagent-loop'
import type { ProbotTurn } from '@/lib/chat/probot-ai'
import type { ProAgentPayload } from '@/lib/types/chat'
import { portalBriefForUser } from '@/lib/places/portal'

export interface HubBotMessage {
  id: string
  conversationId: string
  sender: 'admin'
  body: string
  created_at: string
  admin_sent_as: 'probot'
  payload: ProAgentPayload | null
}

async function conversationPaused(conversationId: string): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('probot_conversations')
    .select('agent_paused_at')
    .eq('id', conversationId)
    .maybeSingle()
  if (error) return false
  return Boolean(data?.agent_paused_at)
}

async function supersedePendingDrafts(conversationId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('probot_agent_steps')
    .update({ status: 'failed', output: { reason: 'superseded' } })
    .eq('conversation_id', conversationId)
    .eq('status', 'needs_confirm')
  if (error && error.code !== '42P01' && error.code !== '42703') {
    console.error('ProAgent supersede failed:', error.message)
  }
}

async function saveSteps(conversationId: string, messageId: string, steps: AgentStepDraft[]): Promise<void> {
  if (steps.length === 0) return
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('probot_agent_steps').insert(
    steps.map((step, index) => ({
      id: step.id,
      conversation_id: conversationId,
      message_id: messageId,
      step_index: index,
      tool_name: step.toolName,
      status: step.status,
      latency_ms: Math.max(0, Math.round(step.latencyMs)),
      input: (step.input ?? null) as Json,
      output: (step.output ?? null) as Json,
    }))
  )
  if (error) console.error('ProAgent steps were not saved:', error.message)
}

/**
 * Answer a hub-thread message. Returns null when a Hub Agent has the thread paused.
 */
export async function answerHubThread(input: {
  conversationId: string
  locale?: string
  history: ProbotTurn[]
  body: string
  userId?: string
}): Promise<HubBotMessage | null> {
  if (await conversationPaused(input.conversationId)) return null
  await supersedePendingDrafts(input.conversationId)

  let portalBrief = ''
  if (input.userId) {
    try {
      portalBrief = await portalBriefForUser(input.userId)
    } catch (err) {
      console.error('Portal brief failed:', err)
    }
  }

  const turn = await runProAgentTurn({
    body: input.body,
    locale: input.locale,
    history: input.history,
    portalBrief,
  })

  const supabase = createServiceRoleClient()
  const withPayload = {
    conversation_id: input.conversationId,
    sender: 'admin' as const,
    body: turn.body,
    admin_sent_as: 'probot' as const,
    payload: (turn.payload ?? null) as Json,
  }
  let inserted = await supabase
    .from('probot_messages')
    .insert(withPayload)
    .select('id, conversation_id, sender, body, created_at, payload')
    .single()

  if (isMissingColumnError(inserted.error)) {
    const { payload: _payload, ...withoutPayload } = withPayload
    inserted = await supabase
      .from('probot_messages')
      .insert(withoutPayload)
      .select('id, conversation_id, sender, body, created_at')
      .single()
  }

  if (inserted.error || !inserted.data) {
    console.error('ProAgent reply insert error:', inserted.error)
    return null
  }

  const row = inserted.data
  await saveSteps(input.conversationId, row.id, turn.steps)
  if (turn.provider !== 'script' && turn.provider !== 'none') {
    await recordProbotTrace({
      conversationId: input.conversationId,
      provider: turn.provider,
      model: turn.model,
      playbookAttached: turn.playbookAttached,
      latencyMs: turn.latencyMs,
      outcome: turn.outcome,
    })
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: 'admin',
    body: row.body,
    created_at: row.created_at,
    admin_sent_as: 'probot',
    payload: parseAgentPayload('payload' in row ? row.payload : turn.payload),
  }
}

import type { Json } from '@/lib/types/supabase'
import type { ProbotLimit } from '@/lib/chat/probot-usage'
import type { ProAgentPersona } from '@/lib/chat/proagent-loop'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isMissingColumnError } from '@/lib/chat/probot-reply'
import { recordProbotTrace } from '@/lib/chat/probot-trace'
import { parseAgentPayload } from '@/lib/chat/proagent-policy'
import { runProAgentTurn, type AgentStepDraft, type ProAgentProgress } from '@/lib/chat/proagent-loop'
import type { ProbotTurn } from '@/lib/chat/probot-ai'
import type { ChatPlantId, ProAgentPayload } from '@/lib/types/chat'
import { portalBriefForUser } from '@/lib/places/portal'

export interface HubBotMessage {
  id: string
  conversationId: string
  sender: 'admin'
  body: string
  created_at: string
  admin_sent_as: 'probot'
  payload: ProAgentPayload | null
  /** ProBot's spoken reply (a voice note), when it answers a voice note. */
  attachments?: { url: string; name: string; contentType: string }[]
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
  onProgress?: (event: ProAgentProgress) => void
  /** The reply answers a plant photo: kept on the reply so an admin can correct it. */
  plantId?: ChatPlantId
  persona?: ProAgentPersona
  /** The ProBot chat the reply goes into. */
  chatId?: string
  /** Over today's ProBot limit: a fixed answer, no AI. */
  overLimit?: ProbotLimit
  /** Cards from before the AI turn (a receipt's expense draft), saved on the reply. */
  extraPayload?: ProAgentPayload
  /** Voice turn: short spoken answer from the fast model. */
  spoken?: boolean
  /** From the plan: smart model allowed, and the upgrade line on the limit message. */
  smartModel?: boolean
  upgradeHint?: boolean
}): Promise<HubBotMessage | null> {
  const [paused, portalBrief] = await Promise.all([
    conversationPaused(input.conversationId),
    input.userId
      ? portalBriefForUser(input.userId).catch((err: unknown) => {
          console.error('Portal brief failed:', err)
          return ''
        })
      : Promise.resolve(''),
  ])
  if (paused) return null
  await supersedePendingDrafts(input.conversationId)

  const turn = await runProAgentTurn({
    body: input.body,
    locale: input.locale,
    history: input.history,
    portalBrief,
    userId: input.userId,
    onProgress: input.onProgress,
    persona: input.persona,
    overLimit: input.overLimit,
    spoken: input.spoken,
    smartModel: input.smartModel,
    upgradeHint: input.upgradeHint,
  })

  const supabase = createServiceRoleClient()
  const withPayload = {
    conversation_id: input.conversationId,
    sender: 'admin' as const,
    body: turn.body,
    admin_sent_as: 'probot' as const,
    payload: (input.plantId || input.extraPayload
      ? { ...(turn.payload ?? {}), ...(input.extraPayload ?? {}), ...(input.plantId ? { plantId: input.plantId } : {}) }
      : turn.payload ?? null) as Json,
  }
  let inserted = await supabase
    .from('probot_messages')
    .insert(input.chatId ? { ...withPayload, chat_id: input.chatId } : withPayload)
    .select('id, conversation_id, sender, body, created_at, payload')
    .single()
  // Before migration 180 there is no chat_id: save it in the single thread.
  if (input.chatId && isMissingColumnError(inserted.error)) {
    inserted = await supabase
      .from('probot_messages')
      .insert(withPayload)
      .select('id, conversation_id, sender, body, created_at, payload')
      .single()
  }

  // Older databases lack payload and/or admin_sent_as; save the reply without them.
  if (isMissingColumnError(inserted.error)) {
    const { payload: _payload, ...withoutPayload } = withPayload
    inserted = await supabase
      .from('probot_messages')
      .insert(withoutPayload)
      .select('id, conversation_id, sender, body, created_at')
      .single()
  }
  if (isMissingColumnError(inserted.error)) {
    const { payload: _payload, admin_sent_as: _sentAs, ...plain } = withPayload
    inserted = await supabase
      .from('probot_messages')
      .insert(plain)
      .select('id, conversation_id, sender, body, created_at')
      .single()
  }

  if (inserted.error || !inserted.data) {
    console.error('ProAgent reply insert error:', inserted.error)
    return null
  }

  const row = inserted.data
  // Speech (and the response) must not wait on step logs or the trace row.
  void saveSteps(input.conversationId, row.id, turn.steps)
  if (turn.provider !== 'script' && turn.provider !== 'none') {
    void recordProbotTrace({
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

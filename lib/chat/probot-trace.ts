import { createServiceRoleClient } from '@/lib/supabase/server'

export interface ProbotTrace {
  conversationId: string
  provider: string
  model: string
  playbookAttached: boolean
  latencyMs: number
  outcome: 'model' | 'fallback'
}

let loggedTraceFailure = false

/** Save which model answered. The visitor message is not stored. */
export async function recordProbotTrace(trace: ProbotTrace): Promise<void> {
  try {
    const supabase = createServiceRoleClient()
    const { error } = await supabase.from('probot_reply_traces').insert({
      conversation_id: trace.conversationId,
      provider: trace.provider,
      model: trace.model,
      playbook_attached: trace.playbookAttached,
      latency_ms: Math.max(0, Math.round(trace.latencyMs)),
      outcome: trace.outcome,
    })
    if (error && !loggedTraceFailure) {
      loggedTraceFailure = true
      console.error('ProBot trace was not saved:', error.message)
    }
  } catch (err) {
    if (!loggedTraceFailure) {
      loggedTraceFailure = true
      console.error('ProBot trace was not saved:', err)
    }
  }
}

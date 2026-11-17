import { createServiceRoleClient } from '@/lib/supabase/server'

/** Process-local fallback when the shared lock RPC is unavailable. */
const memoryLocks = new Set<string>()

const DEFAULT_TTL_MS = 90_000

let sharedLockWarned = false

/**
 * Claim the right to answer one hub conversation across app instances.
 * Falls back to an in-process Set when the DB lock is unreachable.
 */
export async function claimHubReply(
  conversationId: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase.rpc('claim_hub_reply', {
      p_conversation_id: conversationId,
      p_ttl_ms: ttlMs,
    })
    if (!error && typeof data === 'boolean') return data
    if (!sharedLockWarned) {
      sharedLockWarned = true
      console.warn(
        'Shared hub reply lock unavailable; using in-memory fallback.',
        error?.message ?? 'unexpected response'
      )
    }
  } catch (error) {
    if (!sharedLockWarned) {
      sharedLockWarned = true
      console.warn(
        'Shared hub reply lock unavailable; using in-memory fallback.',
        error instanceof Error ? error.message : error
      )
    }
  }

  if (memoryLocks.has(conversationId)) return false
  memoryLocks.add(conversationId)
  return true
}

export async function releaseHubReply(conversationId: string): Promise<void> {
  memoryLocks.delete(conversationId)
  try {
    const supabase = createServiceRoleClient()
    await supabase.rpc('release_hub_reply', { p_conversation_id: conversationId })
  } catch (error) {
    console.warn(
      'Hub reply lock release failed:',
      error instanceof Error ? error.message : error
    )
  }
}

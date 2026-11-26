/**
 * ProBot memory: facts a signed-in person tells ProBot, saved with the remember_fact tool and added
 * to the end of later prompts (about 100 tokens). No extra AI call. Server only.
 */
import { createServiceRoleClient } from '@/lib/supabase/server'
import { redactForModel } from '@/lib/chat/probot-redact'

export type MemoryMode = 'personal' | 'business'

const MAX_FACTS = 20

export function memoryOpenAiTools() {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'remember_fact',
        description:
          'Save one short, lasting fact the person told you about themselves, their home or their business, so you know it in later chats (e.g. "Crew starts at 6am", "Has a pool in the backyard", "Prefers Spanish with the crew"). Only facts they said, never guesses, never passwords, card numbers or other secrets. Do not save one-time questions.',
        parameters: {
          type: 'object',
          properties: { fact: { type: 'string', description: 'The fact, one short sentence, max 200 characters.' } },
          required: ['fact'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'forget_fact',
        description: 'Forget saved facts when the person asks you to forget something or says a saved fact is wrong.',
        parameters: {
          type: 'object',
          properties: { about: { type: 'string', description: 'Words from the fact to forget.' } },
          required: ['about'],
        },
      },
    },
  ]
}

export function isMemoryTool(name: string): boolean {
  return name === 'remember_fact' || name === 'forget_fact'
}

/** The saved facts, newest first (empty before migration 183). */
export async function loadMemories(userId: string, mode: MemoryMode): Promise<string[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('probot_memories')
    .select('fact')
    .eq('user_id', userId)
    .eq('profile_mode', mode)
    .order('created_at', { ascending: false })
    .limit(MAX_FACTS)
  if (error) return []
  return ((data ?? []) as { fact: string }[]).map((row) => row.fact)
}

/** The facts as the last block of the prompt. */
export function memoryPrompt(facts: string[]): string {
  if (facts.length === 0) return ''
  return `\n\nWhat this person told you in earlier chats (use it when it helps, do not repeat it back unasked):\n${facts.map((fact) => `- ${fact}`).join('\n')}`
}

export async function runMemoryTool(
  name: string,
  args: Record<string, unknown>,
  context: { userId: string; mode: MemoryMode }
): Promise<{ data: unknown; isError: boolean }> {
  const supabase = createServiceRoleClient()
  if (name === 'remember_fact') {
    // Same redaction as chat text: no phone numbers, emails or card numbers in memory.
    const fact = redactForModel(String(args.fact ?? '')).replace(/\s+/g, ' ').trim().slice(0, 200)
    if (fact.length < 3) return { data: { error: 'Fact is empty.' }, isError: true }
    const { data: existing } = await supabase
      .from('probot_memories')
      .select('id, fact')
      .eq('user_id', context.userId)
      .eq('profile_mode', context.mode)
      .limit(100)
    if ((existing ?? []).some((row) => (row as { fact: string }).fact.toLowerCase() === fact.toLowerCase())) {
      return { data: { saved: true, note: 'Already known.' }, isError: false }
    }
    const { error } = await supabase.from('probot_memories').insert({ user_id: context.userId, profile_mode: context.mode, fact })
    if (error) return { data: { error: 'Could not save.' }, isError: true }
    // Keep the newest 50 per side.
    const rows = ((existing ?? []) as { id: string }[])
    if (rows.length >= 50) {
      const { data: old } = await supabase
        .from('probot_memories')
        .select('id')
        .eq('user_id', context.userId)
        .eq('profile_mode', context.mode)
        .order('created_at', { ascending: true })
        .limit(rows.length - 49)
      const ids = ((old ?? []) as { id: string }[]).map((row) => row.id)
      if (ids.length) await supabase.from('probot_memories').delete().in('id', ids)
    }
    return { data: { saved: true }, isError: false }
  }
  const about = String(args.about ?? '').trim().toLowerCase()
  if (!about) return { data: { error: 'Say what to forget.' }, isError: true }
  const { data } = await supabase
    .from('probot_memories')
    .select('id, fact')
    .eq('user_id', context.userId)
    .eq('profile_mode', context.mode)
    .limit(100)
  const words = about.split(/\s+/).filter((word) => word.length > 2)
  const ids = ((data ?? []) as { id: string; fact: string }[])
    .filter((row) => words.some((word) => row.fact.toLowerCase().includes(word)))
    .map((row) => row.id)
  if (ids.length) await supabase.from('probot_memories').delete().in('id', ids)
  return { data: { forgotten: ids.length }, isError: false }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';

type Service = SupabaseClient<Database>;

/**
 * The signed-in person's one chat thread. Reused so a pro's personal account and their
 * business share a conversation; messages are separated by business_id.
 */
export async function ensureOwnerConversation(
  supabase: Service,
  userId: string
): Promise<{ id: string; visitorId: string }> {
  const { data: existing } = await supabase
    .from('probot_conversations')
    .select('id, visitor_id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id && existing.visitor_id) {
    return { id: existing.id, visitorId: existing.visitor_id };
  }

  const visitorId = `owner-${userId}`;
  const { data: inserted, error } = await supabase
    .from('probot_conversations')
    .insert({ visitor_id: visitorId, user_id: userId })
    .select('id, visitor_id')
    .single();
  if (inserted?.id && inserted.visitor_id) {
    return { id: inserted.id, visitorId: inserted.visitor_id };
  }

  const { data: again } = await supabase
    .from('probot_conversations')
    .select('id, visitor_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (again?.id && again.visitor_id) return { id: again.id, visitorId: again.visitor_id };
  throw new Error(error?.message || 'Could not open the personal chat');
}

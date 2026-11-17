import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';

/**
 * Unread messages sent TO a signed-in user, split by profile.
 * - business: customers' messages to the user's business (keys `conv:<id>` and `customer-<userId>`)
 * - personal: pro / ProBot replies in the user's own chats (keys `business:<id>` and `probot`)
 * Each side clears only when that profile opens the chat (read_at is set per side).
 */
export interface UnreadByContact {
  counts: Record<string, number>;
  business: number;
  personal: number;
}

export async function loadUnreadByContact(
  db: SupabaseClient<Database>,
  userId: string,
  businessId: string | null
): Promise<UnreadByContact> {
  const counts: Record<string, number> = {};
  const bump = (key: string) => {
    counts[key] = (counts[key] ?? 0) + 1;
  };
  let business = 0;
  let personal = 0;

  if (businessId) {
    const { data: unread } = await db
      .from('probot_messages')
      .select('conversation_id')
      .eq('business_id', businessId)
      .eq('sender', 'visitor')
      .is('read_at', null)
      .limit(2000);
    const rows = unread ?? [];
    business = rows.length;
    const convIds = [...new Set(rows.map((row) => row.conversation_id))];
    if (convIds.length) {
      const { data: convs } = await db.from('probot_conversations').select('id, user_id').in('id', convIds);
      const owner = new Map((convs ?? []).map((conv) => [conv.id, conv.user_id]));
      for (const row of rows) {
        bump(`conv:${row.conversation_id}`);
        const customerUserId = owner.get(row.conversation_id);
        if (customerUserId) bump(`customer-${customerUserId}`);
      }
    }
  }

  const { data: mine } = await db.from('probot_conversations').select('id').eq('user_id', userId);
  const myConvIds = (mine ?? []).map((conv) => conv.id);
  if (myConvIds.length) {
    const { data: replies } = await db
      .from('probot_messages')
      .select('business_id')
      .in('conversation_id', myConvIds)
      .eq('sender', 'admin')
      .is('read_at', null)
      .limit(2000);
    for (const row of replies ?? []) {
      // Replies from the user's own business are business-side activity, not personal mail.
      if (businessId && row.business_id === businessId) continue;
      personal += 1;
      bump(row.business_id ? `business:${row.business_id}` : 'probot');
    }
  }

  return { counts, business, personal };
}

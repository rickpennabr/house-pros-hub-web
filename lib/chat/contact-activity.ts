import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';

/**
 * Latest message time per chat contact, so the ProBot sidebar can sort like WhatsApp (newest chat first).
 * Keys match the unread badges:
 * - business side (customers of the user's business): `conv:<conversationId>`, `customer-<userId>`, `visitor-<visitorId>`
 * - personal side (the user's own chats with pros): `business:<businessId>`
 */
export async function loadContactActivity(
  db: SupabaseClient<Database>,
  userId: string,
  businessId: string | null
): Promise<Record<string, string>> {
  const latest: Record<string, string> = {};
  const keep = (key: string, at: string) => {
    const current = latest[key];
    if (!current || Date.parse(at) > Date.parse(current)) latest[key] = at;
  };

  const [businessSide, mine] = await Promise.all([
    businessId
      ? db
          .from('probot_messages')
          .select('conversation_id, created_at')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(1000)
      : Promise.resolve({ data: [] as Array<{ conversation_id: string; created_at: string }> }),
    db.from('probot_conversations').select('id').eq('user_id', userId),
  ]);

  const businessRows = (businessSide.data ?? []) as Array<{ conversation_id: string; created_at: string }>;
  if (businessRows.length) {
    const convIds = [...new Set(businessRows.map((row) => row.conversation_id))];
    const { data: convs } = await db
      .from('probot_conversations')
      .select('id, user_id, visitor_id')
      .in('id', convIds);
    const owner = new Map((convs ?? []).map((conv) => [conv.id, conv]));
    for (const row of businessRows) {
      keep(`conv:${row.conversation_id}`, row.created_at);
      const conv = owner.get(row.conversation_id);
      if (conv?.user_id) keep(`customer-${conv.user_id}`, row.created_at);
      else if (conv?.visitor_id) keep(`visitor-${conv.visitor_id}`, row.created_at);
    }
  }

  const myConvIds = (mine.data ?? []).map((conv) => conv.id);
  if (myConvIds.length) {
    const { data: rows } = await db
      .from('probot_messages')
      .select('business_id, created_at')
      .in('conversation_id', myConvIds)
      .not('business_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);
    for (const row of rows ?? []) {
      // Chats with the user's own business are business-side activity, not personal chats.
      if (!row.business_id || (businessId && row.business_id === businessId)) continue;
      keep(`business:${row.business_id}`, row.created_at);
    }
  }

  return latest;
}

/** Newest activity for a contact across every key it can be known by. */
export function contactActivityAt(
  contact: { id: string; isProBot?: boolean; businessId?: string; conversationId?: string; lastActivityAt?: string },
  latest: Record<string, string>
): number {
  if (contact.isProBot) return 0;
  const candidates = [
    contact.lastActivityAt,
    contact.businessId ? latest[`business:${contact.businessId}`] : undefined,
    latest[contact.id],
    contact.conversationId ? latest[`conv:${contact.conversationId}`] : undefined,
  ];
  let best = 0;
  for (const at of candidates) {
    const time = at ? Date.parse(at) : NaN;
    if (Number.isFinite(time) && time > best) best = time;
  }
  return best;
}

/** ProBot pinned first, then newest chat first; contacts without chats keep their original order. */
export function sortContactsByActivity<
  T extends { id: string; isProBot?: boolean; businessId?: string; conversationId?: string; lastActivityAt?: string },
>(contacts: T[], latest: Record<string, string> = {}): T[] {
  return contacts
    .map((contact, index) => ({ contact, index, at: contactActivityAt(contact, latest) }))
    .sort((a, b) => {
      if (a.contact.isProBot !== b.contact.isProBot) return a.contact.isProBot ? -1 : 1;
      if (a.at !== b.at) return b.at - a.at;
      return a.index - b.index;
    })
    .map((entry) => entry.contact);
}

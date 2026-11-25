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
  return (await loadContactActivityWithPreviews(db, userId, businessId)).latest;
}

/** Last message shown under a contact's name (WhatsApp-style chat list). */
export interface ContactPreview {
  body: string;
  at: string;
  /** Sent by the person viewing the list (shows ticks). */
  fromMe: boolean;
  /** For fromMe messages: the other side has read it (blue ticks). */
  read: boolean;
  /** Number of attachments, for "Photo" when the text is empty. */
  attachments: number;
  /** The message is a voice note. */
  voice: boolean;
}

type PreviewRow = {
  created_at: string;
  body: string | null;
  sender: string;
  read_at: string | null;
  attachments: unknown;
};

function previewOf(row: PreviewRow, fromMe: boolean): ContactPreview {
  return {
    body: (row.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
    at: row.created_at,
    fromMe,
    read: Boolean(row.read_at),
    attachments: Array.isArray(row.attachments) ? row.attachments.length : 0,
    voice:
      Array.isArray(row.attachments) &&
      row.attachments.some((att) => {
        const a = att as { name?: string; contentType?: string } | null;
        return Boolean(a && (a.name?.startsWith('voice-note') || a.contentType?.startsWith('audio/')));
      }),
  };
}

/** Latest time and last message per contact, with the same keys as the unread badges. */
export async function loadContactActivityWithPreviews(
  db: SupabaseClient<Database>,
  userId: string,
  businessId: string | null
): Promise<{ latest: Record<string, string>; previews: Record<string, ContactPreview> }> {
  const latest: Record<string, string> = {};
  const previews: Record<string, ContactPreview> = {};
  const keep = (key: string, at: string, preview?: ContactPreview) => {
    const current = latest[key];
    if (!current || Date.parse(at) > Date.parse(current)) {
      latest[key] = at;
      if (preview) previews[key] = preview;
    }
  };

  const [businessSide, mine] = await Promise.all([
    businessId
      ? db
          .from('probot_messages')
          .select('conversation_id, created_at, body, sender, read_at, attachments')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(1000)
      : Promise.resolve({ data: [] as Array<PreviewRow & { conversation_id: string }> }),
    db.from('probot_conversations').select('id').eq('user_id', userId),
  ]);

  const businessRows = (businessSide.data ?? []) as Array<PreviewRow & { conversation_id: string }>;
  if (businessRows.length) {
    const convIds = [...new Set(businessRows.map((row) => row.conversation_id))];
    const { data: convs } = await db
      .from('probot_conversations')
      .select('id, user_id, visitor_id')
      .in('id', convIds);
    const owner = new Map((convs ?? []).map((conv) => [conv.id, conv]));
    for (const row of businessRows) {
      // The business answers as "admin"; customers write as "visitor".
      const preview = previewOf(row, row.sender === 'admin');
      keep(`conv:${row.conversation_id}`, row.created_at, preview);
      const conv = owner.get(row.conversation_id);
      if (conv?.user_id) keep(`customer-${conv.user_id}`, row.created_at, preview);
      else if (conv?.visitor_id) keep(`visitor-${conv.visitor_id}`, row.created_at, preview);
    }
  }

  const myConvIds = (mine.data ?? []).map((conv) => conv.id);
  if (myConvIds.length) {
    const { data: rows } = await db
      .from('probot_messages')
      .select('business_id, created_at, body, sender, read_at, attachments')
      .in('conversation_id', myConvIds)
      .not('business_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);
    for (const row of rows ?? []) {
      // Chats with the user's own business are business-side activity, not personal chats.
      if (!row.business_id || (businessId && row.business_id === businessId)) continue;
      // In the user's own chats they write as "visitor".
      keep(`business:${row.business_id}`, row.created_at, previewOf(row as PreviewRow, row.sender === 'visitor'));
    }
  }

  return { latest, previews };
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

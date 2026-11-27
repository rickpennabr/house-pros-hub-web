import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/types/supabase';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { forwardMessageSchema } from '@/lib/schemas/chat';
import { filterAllowedAttachments } from '@/lib/utils/chatAttachmentAllowlist';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';
import { visitorOwnsConversation } from '@/lib/chat/resolveConversation';
import { canForwardMessage, isSameThread, parseForwardContact } from '@/lib/chat/forward-target';
import { ensureOwnerConversation } from '@/lib/chat/owner-thread';
import type { ChatAttachment } from '@/lib/types/chat';

function asAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return [];
  const list: ChatAttachment[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { url?: unknown; name?: unknown; contentType?: unknown };
    if (typeof row.url !== 'string' || typeof row.name !== 'string' || typeof row.contentType !== 'string') continue;
    list.push({ url: row.url, name: row.name, contentType: row.contentType });
  }
  return list;
}

/**
 * POST /api/chat/messages/forward
 * Copies a message's text and files into other chats. The copy is marked forwarded.
 * Private cards (estimates, invoices, places) are not copied.
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const parsed = forwardMessageSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const { messageId, visitorId, contactIds } = parsed.data;

    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    const supabase = createServiceRoleClient();
    const ownedBusinessId = user ? await getOwnedBusinessId(user.id) : null;

    const { data: message } = await supabase
      .from('probot_messages')
      .select('id, conversation_id, body, attachments, business_id')
      .eq('id', messageId)
      .maybeSingle();
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    const { data: conv } = await supabase
      .from('probot_conversations')
      .select('id, user_id, visitor_id')
      .eq('id', message.conversation_id)
      .maybeSingle();
    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    let allowed = Boolean(user && (conv.user_id === user.id || (ownedBusinessId && message.business_id === ownedBusinessId)));
    if (!allowed && visitorId) {
      const cookieDenied = visitorCookieDenied(request, visitorId);
      if (cookieDenied) return cookieDenied;
      allowed = await visitorOwnsConversation(supabase, message.conversation_id, visitorId);
    }
    if (!allowed) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const attachments = asAttachments(message.attachments);
    const allowedAttachments = attachments.length ? filterAllowedAttachments(attachments) : [];
    const body = (message.body ?? '').trim();
    if (!canForwardMessage(body, allowedAttachments?.length ?? 0)) {
      return NextResponse.json({ error: 'This message cannot be forwarded' }, { status: 400 });
    }

    const source = { conversationId: message.conversation_id, businessId: message.business_id ?? null };
    type InsertRow = Database['public']['Tables']['probot_messages']['Insert'];
    let forwarded = 0;

    for (const contactId of contactIds) {
      const target = parseForwardContact(contactId);
      if (!target) continue;

      let conversationId: string | null = null;
      let sender: 'visitor' | 'admin' = 'visitor';
      let businessId: string | null = null;

      if (target.kind === 'business') {
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('id', target.businessId)
          .eq('is_active', true)
          .maybeSingle();
        if (!biz) continue;
        if (user) {
          const thread = await ensureOwnerConversation(supabase, user.id);
          conversationId = thread.id;
        } else if (visitorId && conv.visitor_id === visitorId) {
          conversationId = conv.id;
        }
        businessId = target.businessId;
        sender = 'visitor';
      } else if (!ownedBusinessId || !user) {
        continue;
      } else if (target.kind === 'customer') {
        const thread =
          target.userId === user.id
            ? await ensureOwnerConversation(supabase, user.id)
            : await supabase
                .from('probot_conversations')
                .select('id')
                .eq('user_id', target.userId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
                .then((res) => (res.data?.id ? { id: res.data.id } : null));
        if (!thread) continue;
        if (target.userId !== user.id) {
          const { data: prior } = await supabase
            .from('probot_messages')
            .select('id')
            .eq('conversation_id', thread.id)
            .eq('business_id', ownedBusinessId)
            .limit(1)
            .maybeSingle();
          if (!prior) continue;
        }
        conversationId = thread.id;
        sender = 'admin';
        businessId = ownedBusinessId;
      } else {
        const { data: thread } = await supabase
          .from('probot_conversations')
          .select('id')
          .eq('visitor_id', target.visitorId)
          .maybeSingle();
        if (!thread) continue;
        const { data: prior } = await supabase
          .from('probot_messages')
          .select('id')
          .eq('conversation_id', thread.id)
          .eq('business_id', ownedBusinessId)
          .limit(1)
          .maybeSingle();
        if (!prior) continue;
        conversationId = thread.id;
        sender = 'admin';
        businessId = ownedBusinessId;
      }

      if (!conversationId || !businessId) continue;
      if (isSameThread(source, { conversationId, businessId })) continue;

      const row: InsertRow = {
        conversation_id: conversationId,
        sender,
        body: body || ' ',
        business_id: businessId,
        payload: { forwarded: true },
        ...(sender === 'admin' ? { admin_sent_as: 'business' } : {}),
        ...(allowedAttachments?.length ? { attachments: allowedAttachments as unknown as Database['public']['Tables']['probot_messages']['Insert']['attachments'] } : {}),
      };
      const { error } = await supabase.from('probot_messages').insert(row);
      if (!error) forwarded += 1;
      else console.error('Forward message insert:', error.message);
    }

    if (forwarded === 0) {
      return NextResponse.json({ error: 'Could not forward the message' }, { status: 400 });
    }
    return NextResponse.json({ forwarded }, { status: 200 });
  } catch (err) {
    console.error('POST /api/chat/messages/forward', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

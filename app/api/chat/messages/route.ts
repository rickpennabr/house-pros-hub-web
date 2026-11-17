import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/types/supabase';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { sendMessageSchema, getMessagesSchema } from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { filterAllowedAttachments } from '@/lib/utils/chatAttachmentAllowlist';
import { chatPushUrl, sendAdminPushNotification, sendBusinessPushNotification } from '@/lib/services/pushNotificationService';
import { answerHubThread } from '@/lib/chat/hub-agent-reply';
import { claimHubReply, releaseHubReply } from '@/lib/chat/hub-reply-lock';
import { parseAgentPayload } from '@/lib/chat/proagent-policy';
import type { ProbotTurn } from '@/lib/chat/probot-ai';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';
import { parseStoredReply, snapshotFromRow } from '@/lib/chat/reply-snapshot';
import { resolveVisitorConversation, visitorOwnsConversation } from '@/lib/chat/resolveConversation';

async function sessionUserId(): Promise<string | undefined> {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    return user?.id;
  } catch {
    return undefined;
  }
}

/**
 * POST /api/chat/messages
 * Visitor sends a message. Creates conversation if needed. Triggers admin notification (Web Push in step 7).
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors?.body?.[0] ?? 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { conversationId: providedConvId, visitorId, body: messageBody, businessId, displayName, userId, attachments: rawAttachments, replyToId, placeShareId, locale } = parsed.data;
    const cookieDenied = visitorCookieDenied(request, visitorId);
    if (cookieDenied) return cookieDenied;

    const attachments = rawAttachments?.length
      ? filterAllowedAttachments(rawAttachments)
      : undefined;
    if (rawAttachments?.length && attachments === null) {
      return NextResponse.json({ error: 'Invalid attachment URL. Attachments must be uploaded via the chat upload endpoint.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    let conversationId = providedConvId;

    if (!conversationId) {
      try {
        const resolved = await resolveVisitorConversation(supabase, visitorId);
        conversationId = resolved.conversationId;
      } catch (insertErr) {
        console.error('ProBot conversation resolve error:', insertErr);
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }
    } else {
      const owns = await visitorOwnsConversation(supabase, conversationId, visitorId);
      if (!owns) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    let replyTo: ReturnType<typeof snapshotFromRow> = null;
    if (replyToId) {
      const { data: target } = await supabase
        .from('probot_messages')
        .select('id, conversation_id, sender, body, attachments')
        .eq('id', replyToId)
        .maybeSingle();
      replyTo = target ? snapshotFromRow(target, conversationId) : null;
      if (!replyTo) {
        return NextResponse.json({ error: 'That message is not in this chat' }, { status: 400 });
      }
    }

    const insertPayload: {
      conversation_id: string;
      sender: 'visitor' | 'admin';
      body: string;
      business_id?: string;
      attachments?: unknown;
      reply_to?: unknown;
      payload?: unknown;
    } = {
      conversation_id: conversationId,
      sender: 'visitor',
      body: (messageBody ?? '').trim() || ' ',
    };
    if (businessId) insertPayload.business_id = businessId;
    if (attachments?.length) insertPayload.attachments = attachments;
    if (replyTo) insertPayload.reply_to = replyTo;
    if (placeShareId && businessId) {
      // Only the signed-in owner of the place can share it.
      const session = await createClient();
      const { data: { user: sessionUser } } = await session.auth.getUser();
      if (!sessionUser) return NextResponse.json({ error: 'Sign in to share a place' }, { status: 401 });
      const { data: place } = await supabase
        .from('customer_places')
        .select('id, name, street, city, state, zip_code')
        .eq('id', placeShareId)
        .eq('user_id', sessionUser.id)
        .maybeSingle();
      if (!place) return NextResponse.json({ error: 'Place not found' }, { status: 404 });
      const address = [place.street, [place.city, place.state].filter(Boolean).join(', '), place.zip_code].filter(Boolean).join(' ');
      insertPayload.payload = { placeShare: { placeId: place.id, name: place.name, address } };
    }

    const selectCols = 'id, conversation_id, sender, body, created_at, business_id, attachments, reply_to, payload';

    type InsertRow = Database['public']['Tables']['probot_messages']['Insert'];
    let result = await supabase
      .from('probot_messages')
      .insert(insertPayload as InsertRow)
      .select(selectCols)
      .single();

    if (result.error && (result.error.code === '42703' || String(result.error.message).includes('does not exist'))) {
      delete insertPayload.reply_to;
      delete insertPayload.attachments;
      const colsWithoutAttachments = 'id, conversation_id, sender, body, created_at, business_id, payload';
      result = await supabase
        .from('probot_messages')
        .insert(insertPayload as InsertRow)
        .select(colsWithoutAttachments)
        .single();
      if (result.data) {
        (result.data as Record<string, unknown>).attachments = attachments ?? [];
      }
    }

    if (result.error) {
      console.error('ProBot message insert error:', result.error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    const message = result.data;

    if (displayName && conversationId) {
      const updateRes = await supabase
        .from('probot_conversations')
        .update({ visitor_display_name: displayName.slice(0, 200) })
        .eq('id', conversationId)
        .eq('visitor_id', visitorId);
      if (updateRes.error?.code === '42703') {
        // Column visitor_display_name may not exist yet (migration 025 not applied)
      }
    }

    if (userId && conversationId) {
      const supabaseAuth = await createClient();
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user?.id === userId) {
        const updateUserRes = await supabase
          .from('probot_conversations')
          .update({ user_id: userId })
          .eq('id', conversationId)
          .eq('visitor_id', visitorId);
        if (updateUserRes.error?.code === '42703') {
          // Column user_id may not exist yet (migration 026 not applied)
        }
      }
    }

    const pushTitle = businessId ? 'New message to a Pro' : 'New message from visitor';
    const pushBody =
      (messageBody ?? '').trim().length > 0
        ? (messageBody ?? '').slice(0, 80) + ((messageBody ?? '').length > 80 ? '…' : '')
        : 'Sent a photo';
    // Badge = total unread visitor messages so app icon shows e.g. "1" on phone
    const { count: adminUnreadCount } = await supabase
      .from('probot_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'visitor')
      .is('read_at', null);
    const badgeCount = typeof adminUnreadCount === 'number' && adminUnreadCount >= 0 ? Math.min(99, adminUnreadCount) : 1;
    await sendAdminPushNotification(pushTitle, pushBody, '/admin/chat', badgeCount);
    if (businessId) {
      await sendBusinessPushNotification(businessId, pushTitle, pushBody, chatPushUrl(locale, 'business'), badgeCount);
    }

    const msg = message as unknown as { id: string; conversation_id: string; sender: string; body: string; created_at: string; attachments?: unknown };

    let botMessage: {
      id: string;
      conversationId: string;
      sender: 'admin';
      body: string;
      created_at: string;
      admin_sent_as: 'probot';
    } | undefined;

    const visitorMessage = {
      id: msg.id,
      conversationId: msg.conversation_id,
      sender: msg.sender,
      body: msg.body,
      created_at: msg.created_at,
      businessId: businessId ?? undefined,
      attachments: msg.attachments ?? attachments ?? [],
      replyTo: replyTo ?? undefined,
    };

    const wantsStream =
      Boolean(parsed.data.stream) &&
      !businessId &&
      Boolean(conversationId) &&
      (request.headers.get('accept') ?? '').includes('text/event-stream');

    // Hub thread only. A message to a pro waits for that pro.
    if (!businessId && conversationId && wantsStream) {
      const claimed = await claimHubReply(conversationId);
      if (!claimed) {
        return NextResponse.json({ message: visitorMessage }, { status: 200 });
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };
          try {
            send('message', visitorMessage);
            const history = await recentHubTurns(supabase, conversationId);
            const answered = await answerHubThread({
              conversationId,
              locale,
              history: history.slice(0, -1),
              body: messageBody ?? '',
              userId: await sessionUserId(),
              onProgress: (progress) => {
                if (progress.type === 'status') send('status', { label: progress.label });
                if (progress.type === 'token') send('token', { text: progress.text });
              },
            });
            if (answered) send('bot', answered);
            send('done', {});
          } catch (error) {
            console.error('ProBot messages stream error:', error);
            send('error', { error: 'Internal server error' });
          } finally {
            await releaseHubReply(conversationId);
            controller.close();
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    if (!businessId && conversationId && (await claimHubReply(conversationId))) {
      try {
        const history = await recentHubTurns(supabase, conversationId);
        const answered = await answerHubThread({
          conversationId,
          locale,
          history: history.slice(0, -1),
          body: messageBody ?? '',
          userId: await sessionUserId(),
        });
        if (answered) botMessage = answered;
      } finally {
        await releaseHubReply(conversationId);
      }
    }

    return NextResponse.json(
      {
        message: visitorMessage,
        ...(botMessage ? { botMessage } : {}),
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('ProBot messages POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/chat/messages?conversationId=...&visitorId=... (visitor) or conversationId only (admin)
 * Returns messages for the conversation. Visitor must pass visitorId and own the conversation.
 */
/**
 * DELETE /api/chat/messages?id=…&visitorId=…
 * Removes a message for everyone in the chat. Customers delete their own messages;
 * a pro deletes the replies sent as their business.
 */
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id') ?? '';
    const visitorId = request.nextUrl.searchParams.get('visitorId') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data: message } = await supabase
      .from('probot_messages')
      .select('id, conversation_id, sender, business_id')
      .eq('id', id)
      .maybeSingle();
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    let allowed = false;
    if (message.sender === 'visitor') {
      if (!visitorId) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      const cookieDenied = visitorCookieDenied(request, visitorId);
      if (cookieDenied) return cookieDenied;
      allowed = await visitorOwnsConversation(supabase, message.conversation_id, visitorId);
    } else if (message.business_id) {
      const session = await createClient();
      const { data: { user } } = await session.auth.getUser();
      if (user) allowed = (await getOwnedBusinessId(user.id)) === message.business_id;
    }
    if (!allowed) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const { error } = await supabase.from('probot_messages').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/chat/messages', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chatRead');
  if (rateLimitRes) return rateLimitRes;

  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const visitorId = searchParams.get('visitorId') ?? undefined;
    const locale = searchParams.get('locale') ?? undefined;
    const parsed = getMessagesSchema.safeParse({ conversationId, visitorId, locale });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const hasVisitorId = Boolean(parsed.data.visitorId?.trim());
    if (hasVisitorId) {
      const cookieDenied = visitorCookieDenied(request, parsed.data.visitorId!);
      if (cookieDenied) return cookieDenied;
    }
    let user: { id: string; email?: string | null } | null = null;
    let isAdmin = false;
    let supabaseServer: Awaited<ReturnType<typeof createClient>> | null = null;

    // Guests poll with visitorId and are authorized by conversation ownership.
    // Skip the cookie session lookup so each poll does not wait on a missing auth session.
    if (!hasVisitorId) {
      supabaseServer = await createClient();
      const {
        data: { user: authUser },
        error: userError,
      } = await supabaseServer.auth.getUser();
      user = authUser;
      isAdmin =
        !userError &&
        !!user?.email &&
        user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    }

    const supabase = createServiceRoleClient();

    let contractorReadBusinessId: string | null = null;
    if (!isAdmin && !hasVisitorId) {
      if (!supabaseServer || !user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const userBusinessId = await getOwnedBusinessId(user.id);
      if (!userBusinessId) {
        return NextResponse.json({ error: 'visitorId required for visitor' }, { status: 400 });
      }
      contractorReadBusinessId = userBusinessId;
      const { data: msgRow } = await supabase
        .from('probot_messages')
        .select('id')
        .eq('conversation_id', parsed.data.conversationId)
        .eq('business_id', userBusinessId)
        .limit(1)
        .maybeSingle();
      if (!msgRow) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    const isVisitorContext = Boolean(parsed.data.visitorId?.trim());
    if (isVisitorContext) {
      const owns = await visitorOwnsConversation(
        supabase,
        parsed.data.conversationId,
        parsed.data.visitorId!
      );
      if (!owns) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    // WhatsApp-style: one thread per profile. For admin/contractor, load messages from all conversations for this visitor and merge.
    let conversationIds: string[] = [parsed.data.conversationId];
    if (!isVisitorContext) {
      const { data: convRow } = await supabase
        .from('probot_conversations')
        .select('visitor_id')
        .eq('id', parsed.data.conversationId)
        .single();
      if (convRow?.visitor_id) {
        const vid = (convRow as { visitor_id: string }).visitor_id;
        const { data: allConvs } = await supabase
          .from('probot_conversations')
          .select('id')
          .eq('visitor_id', vid);
        let ids = (allConvs ?? []) as { id: string }[];
        if (contractorReadBusinessId && ids.length > 0) {
          const { data: msgConvs } = await supabase
            .from('probot_messages')
            .select('conversation_id')
            .in('conversation_id', ids.map((c) => c.id))
            .eq('business_id', contractorReadBusinessId);
          const allowed = new Set((msgConvs ?? []).map((r) => (r as { conversation_id: string }).conversation_id));
          ids = ids.filter((c) => allowed.has(c.id));
        }
        if (ids.length) conversationIds = ids.map((c) => c.id);
      }
    }

    type MessageRow = { id: string; sender: string; body: string; created_at: string; business_id?: string | null; read_at?: string | null; attachments?: unknown; reply_to?: unknown; admin_sent_as?: string | null; admin_user_id?: string | null; payload?: unknown };
    let rawMessages: MessageRow[] | null = null;

    // Newest columns first. Fallbacks only drop optional columns and keep the card payload while it exists.
    const columnSets = [
      'id, sender, body, created_at, business_id, read_at, attachments, reply_to, admin_user_id, payload',
      'id, sender, body, created_at, business_id, read_at, attachments, payload',
      'id, sender, body, created_at, business_id, read_at, payload',
      'id, sender, body, created_at, business_id, read_at',
      'id, sender, body, created_at, business_id',
    ];
    let lastSelectError: { code?: string; message?: string } | null = null;
    for (const cols of columnSets) {
      const result = await supabase
        .from('probot_messages')
        .select(cols)
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true })
        .limit(300);
      if (!result.error) {
        if (lastSelectError) console.warn('ProBot messages GET fallback columns:', cols, '-', lastSelectError.message);
        rawMessages = ((result.data ?? []) as unknown as Partial<MessageRow>[]).map((m) => ({
          read_at: null,
          attachments: [],
          admin_user_id: null,
          ...m,
        })) as MessageRow[];
        break;
      }
      lastSelectError = result.error;
      const isColumnError = result.error.code === '42703' || String(result.error.message).includes('does not exist');
      if (!isColumnError) break;
    }
    if (!rawMessages) {
      console.error('ProBot messages GET error:', lastSelectError);
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    let rows = rawMessages ?? [];
    if (contractorReadBusinessId) {
      rows = rows.filter(
        (m) => m.sender === 'admin' || m.business_id === contractorReadBusinessId
      );
    }

    // Visitor is waiting on the hub thread (no pro selected). Answer once the latest hub message is theirs.
    if (isVisitorContext && !contractorReadBusinessId) {
      const hubRows = rows.filter((m) => !m.business_id);
      const lastHub = hubRows[hubRows.length - 1];
      if (
        lastHub?.sender === 'visitor' &&
        lastHub.body.trim() &&
        (await claimHubReply(parsed.data.conversationId))
      ) {
        try {
          const history = hubRows.slice(0, -1).map((row) => ({
            sender: row.sender === 'admin' ? ('admin' as const) : ('visitor' as const),
            body: row.body,
          }));
          const answered = await answerHubThread({
            conversationId: parsed.data.conversationId,
            locale: parsed.data.locale,
            history,
            body: lastHub.body,
            userId: await sessionUserId(),
          });
          if (answered) {
            rows = [
              ...rows,
              {
                id: answered.id,
                sender: answered.sender,
                body: answered.body,
                created_at: answered.created_at,
                business_id: null,
                read_at: null,
                attachments: [],
                admin_sent_as: 'probot',
                admin_user_id: null,
                payload: answered.payload,
              },
            ];
          }
        } finally {
          await releaseHubReply(parsed.data.conversationId);
        }
      }
    }

    // Mark as read by context: visitor viewing (has visitorId) = mark admin messages read only;
    // admin/contractor viewing = mark visitor messages read across all conversations in this thread (WhatsApp-style one thread per profile).
    const nowIso = new Date().toISOString();
    let readAtUpdated = false;
    if (isVisitorContext) {
      const hasUnreadAdmin = rows.some((m) => m.sender === 'admin' && !m.read_at);
      if (hasUnreadAdmin) {
        const up = await supabase
          .from('probot_messages')
          .update({ read_at: nowIso })
          .eq('conversation_id', parsed.data.conversationId)
          .eq('sender', 'admin')
          .is('read_at', null);
        readAtUpdated = !up.error || up.error.code !== '42703';
      }
    } else {
      const hasUnreadVisitor = rows.some(
        (m) =>
          m.sender === 'visitor' &&
          !m.read_at &&
          (!contractorReadBusinessId || m.business_id === contractorReadBusinessId)
      );
      if (hasUnreadVisitor) {
        let up = supabase
          .from('probot_messages')
          .update({ read_at: nowIso })
          .in('conversation_id', conversationIds)
          .eq('sender', 'visitor')
          .is('read_at', null);
        if (contractorReadBusinessId) {
          up = up.eq('business_id', contractorReadBusinessId);
        }
        const upResult = await up;
        readAtUpdated = !upResult.error || upResult.error.code !== '42703';
      }
    }

    const businessIds = [...new Set(rows.map((m) => m.business_id).filter((id): id is string => typeof id === 'string' && id.length > 0))];
    let businessNames: Record<string, string> = {};
    if (businessIds.length > 0) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, business_name')
        .in('id', businessIds);
      if (biz) {
        businessNames = Object.fromEntries((biz as { id: string; business_name: string }[]).map((b) => [b.id, b.business_name]));
      }
    }

    const adminUserIds = [...new Set(rows.filter((m) => m.sender === 'admin' && m.admin_user_id).map((m) => m.admin_user_id!))];
    type ProfileRow = { id: string; first_name: string | null; last_name: string | null; user_picture: string | null };
    let adminProfiles: Record<string, { admin_avatar_url: string | null; admin_display_name: string | null }> = {};
    if (adminUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_picture')
        .in('id', adminUserIds);
      for (const p of profiles ?? []) {
        const row = p as ProfileRow;
        const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null;
        adminProfiles[row.id] = { admin_avatar_url: row.user_picture ?? null, admin_display_name: name };
      }
    }

    const messages = rows.map((m) => {
      const justMarked = readAtUpdated && (
        (isVisitorContext && m.sender === 'admin') ||
        (!isVisitorContext && m.sender === 'visitor' && (!contractorReadBusinessId || m.business_id === contractorReadBusinessId))
      );
      const readAt = m.read_at ?? (justMarked ? nowIso : undefined);
      const adminUserId = m.admin_user_id ?? undefined;
      const adminProfile = adminUserId ? adminProfiles[adminUserId] : undefined;
      return {
        id: m.id,
        sender: m.sender,
        body: m.body,
        created_at: m.created_at,
        business_id: m.business_id ?? undefined,
        business_name: m.business_id ? businessNames[m.business_id] : undefined,
        read_at: readAt ?? undefined,
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
        replyTo: parseStoredReply(m.reply_to),
        admin_sent_as: m.admin_sent_as ?? undefined,
        admin_user_id: adminUserId,
        admin_avatar_url: adminProfile?.admin_avatar_url ?? undefined,
        admin_display_name: adminProfile?.admin_display_name ?? undefined,
        payload: parseAgentPayload(m.payload),
      };
    });

    // For visitor: include hub agent (most recent admin who sent as hub_agent) for header display
    let hubAgent: { displayName: string; avatarUrl: string | null } | undefined;
    if (isVisitorContext && adminUserIds.length > 0) {
      const adminMessagesWithUser = rows
        .filter((m) => m.sender === 'admin' && m.admin_user_id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastAdminMsg = adminMessagesWithUser[0];
      const uid = lastAdminMsg?.admin_user_id;
      if (uid && adminProfiles[uid]) {
        const name = adminProfiles[uid].admin_display_name?.trim();
        if (name) hubAgent = { displayName: name, avatarUrl: adminProfiles[uid].admin_avatar_url };
      }
    }

    return NextResponse.json({ messages, hubAgent }, { status: 200 });
  } catch (e) {
    console.error('ProBot messages GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function recentHubTurns(
  supabase: ReturnType<typeof createServiceRoleClient>,
  conversationId: string
): Promise<ProbotTurn[]> {
  const { data, error } = await supabase
    .from('probot_messages')
    .select('sender, body, business_id, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(16);
  if (error) return [];
  return ((data ?? []) as { sender: string; body: string; business_id?: string | null }[])
    .filter((row) => !row.business_id && row.body.trim())
    .slice(-8)
    .map((row) => ({
      sender: row.sender === 'admin' ? 'admin' : 'visitor',
      body: row.body,
    }));
}

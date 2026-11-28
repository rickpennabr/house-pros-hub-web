import { NextRequest, NextResponse, after } from 'next/server';
import type { Database } from '@/lib/types/supabase';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { sendMessageSchema, getMessagesSchema, messageFeedbackSchema } from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { filterAllowedAttachments } from '@/lib/utils/chatAttachmentAllowlist';
import { chatPushUrl, sendAdminPushNotification, sendBusinessPushNotification } from '@/lib/services/pushNotificationService';
import { answerHubThread } from '@/lib/chat/hub-agent-reply';
import { photoContext } from '@/lib/chat/photo-context';
import { chatAttachmentObjectPath, transcribeVoiceNote } from '@/lib/ai/read-attachment';
import { attachSpokenReply } from '@/lib/ai/speech';
import { DEFAULT_PROBOT_VOICE, isProbotVoiceId } from '@/lib/ai/voices';
import { currentPlanForUser } from '@/lib/billing/plans';
import { PROBOT_TIERS, probotTier, voiceAllowed } from '@/lib/billing/probot-tiers';
import { probotLimitReached, type ProbotLimit } from '@/lib/chat/probot-usage';
import { readReceipt } from '@/lib/ai/read-receipt';
import { userOwnsCrm } from '@/lib/crm/require-contractor';
import type { ProAgentPayload } from '@/lib/types/chat';
import { parseReactions } from '@/lib/chat/reactions';
import { claimHubReply, releaseHubReply } from '@/lib/chat/hub-reply-lock';
import { parseAgentPayload } from '@/lib/chat/proagent-policy';
import type { ProbotTurn } from '@/lib/chat/probot-ai';
import type { ChatAttachment } from '@/lib/types/chat';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';
import { parseStoredReply, snapshotFromRow } from '@/lib/chat/reply-snapshot';
import { resolveVisitorConversation, visitorOwnsConversation } from '@/lib/chat/resolveConversation';

/** Columns that succeeded last time, so a missing chat_id is not queried and logged on every poll. */
let messageSelectColumns: string | null = null;
let loggedMissingMessageColumn = false;

/** The signed-in admin is never held to ProBot's daily limit. */
async function isAdminSession(): Promise<boolean> {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    return Boolean(user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase());
  } catch {
    return false;
  }
}

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
    const { conversationId: providedConvId, visitorId, body: messageBody, businessId, displayName, userId, attachments: rawAttachments, replyToId, placeShareId, locale, actingAs, actingFirstName, actingBusinessName, chatId: rawChatId, voice: rawVoice } = parsed.data;
    const pickedVoice = isProbotVoiceId(rawVoice) ? rawVoice : null;
    // The business profile only for someone who owns a business; anyone else talks to ProBot as personal.
    const signedInId = actingAs === 'business' ? await sessionUserId() : null;
    const ownsBusiness = signedInId ? Boolean(await getOwnedBusinessId(signedInId)) : false;
    const actingAsChecked = actingAs === 'business' && !ownsBusiness ? 'personal' : actingAs;
    const persona = actingAsChecked ? { mode: actingAsChecked, firstName: actingFirstName, businessName: actingAsChecked === 'business' ? actingBusinessName : undefined } : undefined;
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

    // A ProBot chat (hub only) must belong to this conversation.
    let chatId: string | undefined;
    let chatTitle: string | null = null;
    if (rawChatId && !businessId) {
      const { data: chat } = await supabase
        .from('probot_chats')
        .select('id, title')
        .eq('id', rawChatId)
        .eq('conversation_id', conversationId)
        .maybeSingle();
      if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
      chatId = (chat as { id: string }).id;
      chatTitle = (chat as { title: string | null }).title;
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
      chat_id?: string;
    } = {
      conversation_id: conversationId,
      sender: 'visitor',
      body: (messageBody ?? '').trim() || ' ',
    };
    if (businessId) insertPayload.business_id = businessId;
    if (chatId) insertPayload.chat_id = chatId;
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
      delete insertPayload.chat_id;
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

    // The chat is named after its first message (no AI call), and moves to the top of the list.
    if (chatId) {
      const words = (messageBody ?? '').trim().split(/\s+/).filter(Boolean);
      const title =
        chatTitle ||
        (words.length > 0 ? words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : '') : attachments?.some((att) => att.name.startsWith('voice-note')) ? 'Voice chat' : 'Photo chat');
      await supabase.from('probot_chats').update({ title: title.slice(0, 120), updated_at: new Date().toISOString() }).eq('id', chatId);
    }

    // Hub thread: ProBot listens to a voice note. Its words become the message text (shown under the
    // voice bubble and kept in the history), so ProBot answers what was said.
    let spokenBody = messageBody ?? '';
    const voiceNote =
      !businessId && !spokenBody.trim() ? attachments?.find((att) => att.name.startsWith('voice-note')) : undefined;
    // Daily ProBot limit (hub only; the admin is never limited). Over it: no listening, no AI, no voice.
    // What ProBot may do comes from the person's plan (Free, Pro, Team, Business). Guests get Free.
    const planUserId = !businessId ? await sessionUserId() : undefined;
    const planSlug = planUserId ? await currentPlanForUser(planUserId).then((row) => row.plan.slug).catch(() => 'free') : 'free';
    const tier = planUserId ? probotTier(planSlug) : PROBOT_TIERS.free;
    const onFreePlan = planSlug === 'free';
    // A voice the plan does not include falls back to the default (Max).
    const voiceId = pickedVoice && !voiceAllowed(tier, pickedVoice) ? DEFAULT_PROBOT_VOICE : pickedVoice;
    let overLimit: ProbotLimit | undefined;
    if (!businessId && conversationId && !(await isAdminSession())) {
      overLimit = await probotLimitReached(supabase, conversationId, Boolean(voiceNote), {
        turns: tier.dailyAnswers,
        voice: tier.dailyVoice,
      }).catch(() => undefined);
    }

    /**
     * A pro on the business profile sends a photo: if it is a receipt, ProBot offers a "Save expense?"
     * card instead of describing the photo (one read, same as the photo reader).
     */
    const receiptContext = async (): Promise<{ body: string; extraPayload: ProAgentPayload } | null> => {
      const photo = attachments?.find((att) => att.contentType.startsWith('image/'));
      if (!photo || overLimit || actingAsChecked !== 'business') return null;
      const userId = await sessionUserId();
      if (!userId || !(await userOwnsCrm(userId).catch(() => false))) return null;
      const draft = await readReceipt(photo).catch(() => null);
      if (!draft) return null;
      const words = (messageBody ?? '').trim();
      return {
        body: `${words || 'Here is a receipt.'}\n\n[The user sent a photo of a receipt from ${draft.vendor || 'a store'} dated ${draft.date}, category ${draft.category}. A "Save expense?" card with the amount is shown under your reply. In one or two sentences, say you read the receipt and ask them to check the card and tap Save. Do not repeat the amount.]`,
        extraPayload: { expenseDraft: draft },
      };
    };

    const loadVoiceBytes = async () => {
      if (!voiceNote) return null;
      const path = chatAttachmentObjectPath(voiceNote.url);
      if (!path) return null;
      const { data, error } = await supabase.storage.from('chat-attachments').download(path);
      if (error || !data) return null;
      const bytes = Buffer.from(await data.arrayBuffer());
      if (!bytes.length) return null;
      const mime = (data.type || voiceNote.contentType || 'audio/webm').split(';')[0].trim();
      return { bytes, mime };
    };

    const hear = async () => {
      if (!voiceNote || overLimit) return;
      const started = Date.now();
      const heard = await transcribeVoiceNote(voiceNote, loadVoiceBytes).catch(() => null);
      console.info(`[probot-voice] stt ${Date.now() - started}ms`);
      if (!heard) return;
      spokenBody = heard;
      await supabase.from('probot_messages').update({ body: heard }).eq('id', (message as unknown as { id: string }).id);
    };

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

    // Notifications go out after the reply starts: the sender never waits on them.
    after(async () => {
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
    });

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
            const voiceStarted = Date.now();
            // History, the signed-in user, and a receipt read do not need the transcript.
            const historyPromise = recentHubTurns(supabase, conversationId, chatId);
            const userPromise = sessionUserId();
            const receiptPromise = receiptContext();
            if (voiceNote && !overLimit) {
              send('status', { label: 'listening' });
              await hear();
              // Show the words under the voice note right away.
              if (spokenBody) send('transcript', { id: (message as unknown as { id: string }).id, text: spokenBody });
            }
            const [history, userId, receipt] = await Promise.all([historyPromise, userPromise, receiptPromise]);
            if (attachments?.some((att) => att.contentType.startsWith('image/'))) send('status', { label: 'reading_photo' });
            if (attachments?.some((att) => att.contentType.startsWith('image/')) && actingAsChecked === 'business') send('status', { label: 'reading_receipt' });
            const photo = receipt ? { body: receipt.body, plantId: undefined } : await photoContext(spokenBody, attachments, locale);
            const answered = await answerHubThread({
              extraPayload: receipt?.extraPayload,
              conversationId,
              locale,
              history: history.slice(0, -1),
              body: photo.body,
              plantId: photo.plantId,
              userId,
              persona,
              chatId,
              overLimit,
              spoken: Boolean(voiceNote && !overLimit),
              smartModel: tier.smartModel,
              upgradeHint: onFreePlan,
              onProgress: (progress) => {
                if (progress.type === 'status') send('status', { label: progress.label });
                if (progress.type === 'token') send('token', { text: progress.text });
              },
            });
            if (voiceNote) console.info(`[probot-voice] reply ${Date.now() - voiceStarted}ms`);
            if (answered) {
              // The text first (already streamed word by word), then speech starts as PCM chunks.
              send('bot', answered);
              if (voiceNote && !overLimit) {
                send('status', { label: 'recording' });
                // The bubble waits for the finished file. Chunks are not sent ahead of it.
                const spoken = await attachSpokenReply(supabase, answered, locale, undefined, voiceId).catch(() => null);
                if (spoken) send('voice', { id: answered.id, attachment: spoken });
              }
            }
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
        const historyPromise = recentHubTurns(supabase, conversationId, chatId);
        const userPromise = sessionUserId();
        const receiptPromise = receiptContext();
        await hear();
        const [history, userId, receipt] = await Promise.all([historyPromise, userPromise, receiptPromise]);
        const photo = receipt ? { body: receipt.body, plantId: undefined } : await photoContext(spokenBody, attachments, locale);
        const answered = await answerHubThread({
          extraPayload: receipt?.extraPayload,
          conversationId,
          locale,
          history: history.slice(0, -1),
          body: photo.body,
          plantId: photo.plantId,
          userId,
          persona,
          chatId,
          overLimit,
          spoken: Boolean(voiceNote && !overLimit),
          smartModel: tier.smartModel,
          upgradeHint: onFreePlan,
        });
        if (answered && voiceNote && !overLimit) {
          const spoken = await attachSpokenReply(supabase, answered, locale, undefined, voiceId).catch(() => null);
          if (spoken) answered.attachments = [spoken];
        }
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
    const parsed = getMessagesSchema.safeParse({ conversationId, visitorId, locale, chatId: searchParams.get('chatId') ?? undefined });
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
    /** This thread belongs to the pro themselves, so only this business's messages are shown. */
    let ownThread = false;
    if (!isAdmin && !hasVisitorId) {
      if (!supabaseServer || !user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const userBusinessId = await getOwnedBusinessId(user.id);
      if (!userBusinessId) {
        return NextResponse.json({ error: 'visitorId required for visitor' }, { status: 400 });
      }
      contractorReadBusinessId = userBusinessId;
      const [{ data: msgRow }, { data: convOwner }] = await Promise.all([
        supabase
          .from('probot_messages')
          .select('id')
          .eq('conversation_id', parsed.data.conversationId)
          .eq('business_id', userBusinessId)
          .limit(1)
          .maybeSingle(),
        supabase.from('probot_conversations').select('user_id').eq('id', parsed.data.conversationId).maybeSingle(),
      ]);
      // The pro can open their own personal thread before the first message.
      ownThread = convOwner?.user_id === user.id;
      if (!msgRow && !ownThread) {
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

    type MessageRow = { id: string; sender: string; body: string; created_at: string; chat_id?: string | null; business_id?: string | null; read_at?: string | null; attachments?: unknown; reply_to?: unknown; admin_sent_as?: string | null; admin_user_id?: string | null; payload?: unknown; reactions?: unknown };
    let rawMessages: MessageRow[] | null = null;

    // Newest columns first. Fallbacks only drop optional columns and keep the card payload while it exists.
    const columnSets = [
      'id, sender, body, created_at, business_id, read_at, attachments, reply_to, admin_user_id, payload, reactions, chat_id',
      'id, sender, body, created_at, business_id, read_at, attachments, reply_to, admin_user_id, payload, reactions',
      'id, sender, body, created_at, business_id, read_at, attachments, reply_to, admin_user_id, payload',
      'id, sender, body, created_at, business_id, read_at, attachments, payload',
      'id, sender, body, created_at, business_id, read_at, payload',
      'id, sender, body, created_at, business_id, read_at',
      'id, sender, body, created_at, business_id',
    ];
    const selectOrder = messageSelectColumns
      ? [messageSelectColumns, ...columnSets.filter((cols) => cols !== messageSelectColumns)]
      : columnSets;
    let lastSelectError: { code?: string; message?: string } | null = null;
    for (const cols of selectOrder) {
      // The pro's own personal thread shares their ProBot conversation. Load only this business's messages
      // so hub history is not mixed in, and the newest 300 are from this chat.
      let query = supabase.from('probot_messages').select(cols).in('conversation_id', conversationIds);
      if (ownThread && contractorReadBusinessId) query = query.eq('business_id', contractorReadBusinessId);
      const result = await query
        // The newest 300, shown oldest first (ascending + limit used to return the oldest 300 and drop new ones).
        .order('created_at', { ascending: false })
        .limit(300);
      if (!result.error) {
        if (lastSelectError && !loggedMissingMessageColumn) {
          loggedMissingMessageColumn = true;
          console.warn('ProBot messages GET fallback columns:', cols, '-', lastSelectError.message);
        }
        messageSelectColumns = cols;
        rawMessages = ((result.data ?? []) as unknown as Partial<MessageRow>[]).reverse().map((m) => ({
          read_at: null,
          attachments: [],
          admin_user_id: null,
          ...m,
        })) as MessageRow[];
        break;
      }
      lastSelectError = result.error;
      if (messageSelectColumns === cols) messageSelectColumns = null;
      const isColumnError = result.error.code === '42703' || String(result.error.message).includes('does not exist');
      if (!isColumnError) break;
    }
    if (!rawMessages) {
      console.error('ProBot messages GET error:', lastSelectError);
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    let rows = rawMessages ?? [];
    if (contractorReadBusinessId) {
      rows = rows.filter((m) =>
        ownThread
          ? m.business_id === contractorReadBusinessId
          : m.sender === 'admin' || m.business_id === contractorReadBusinessId
      );
    }

    // One ProBot chat: its hub messages only (pro threads stay).
    const viewChatId = isVisitorContext ? parsed.data.chatId : undefined;
    if (viewChatId) {
      rows = rows.filter((m) => m.business_id || (viewChatId === 'legacy' ? !m.chat_id : m.chat_id === viewChatId));
    }

    // Visitor is waiting on the hub thread (no pro selected). Answer once the latest hub message is theirs.
    if (isVisitorContext && !contractorReadBusinessId) {
      const hubRows = rows.filter((m) => !m.business_id);
      const lastHub = hubRows[hubRows.length - 1];
      // The stored photos (our chat storage only), so a reply made here sees them like the send path does.
      const lastPhotos = Array.isArray(lastHub?.attachments)
        ? filterAllowedAttachments(
            (lastHub.attachments as ChatAttachment[]).filter(
              (att) => att && typeof att.url === 'string' && typeof att.contentType === 'string'
            )
          ) ?? []
        : [];
      if (
        lastHub?.sender === 'visitor' &&
        (lastHub.body.trim() || lastPhotos.length > 0) &&
        // A voice note not heard yet is answered by its send request, not here.
        !(!lastHub.body.trim() && lastPhotos.some((att) => att.name.startsWith('voice-note'))) &&
        (await claimHubReply(parsed.data.conversationId))
      ) {
        try {
          const history = hubRows.slice(0, -1).map((row) => ({
            sender: row.sender === 'admin' ? ('admin' as const) : ('visitor' as const),
            body: row.body,
          }));
          const photo = await photoContext(lastHub.body, lastPhotos, parsed.data.locale);
          const answered = await answerHubThread({
            conversationId: parsed.data.conversationId,
            locale: parsed.data.locale,
            history,
            body: photo.body,
            plantId: photo.plantId,
            userId: await sessionUserId(),
            chatId: viewChatId && viewChatId !== 'legacy' ? viewChatId : undefined,
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
      const unreadAdminIds = rows.filter((m) => m.sender === 'admin' && !m.read_at).map((m) => m.id);
      if (unreadAdminIds.length > 0) {
        const up = await supabase
          .from('probot_messages')
          .update({ read_at: nowIso })
          .eq('conversation_id', parsed.data.conversationId)
          .eq('sender', 'admin')
          .in('id', unreadAdminIds)
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
        reactions: parseReactions(m.reactions),
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

/** ProBot answers that were wrong before the tools worked; never replayed to the model. */
const STALE_ANSWER = /(do not|don't|cannot|can't) (have )?(access|see)|do not have (those|that) details|I can connect you with a pro\. Pick a contact/i;

async function recentHubTurns(
  supabase: ReturnType<typeof createServiceRoleClient>,
  conversationId: string,
  chatId?: string
): Promise<ProbotTurn[]> {
  // Newest 16, oldest first. A chat remembers only its own messages.
  const query = () =>
    supabase
      .from('probot_messages')
      .select('sender, body, business_id, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(16);
  let result = chatId ? await query().eq('chat_id', chatId) : await query();
  if (chatId && result.error) result = await query();
  const { error } = result;
  const data = (result.data ?? []).slice().reverse();
  if (error) return [];
  return ((data ?? []) as { sender: string; body: string; business_id?: string | null }[])
    .filter((row) => !row.business_id && row.body.trim())
    .filter((row) => row.sender !== 'admin' || !STALE_ANSWER.test(row.body))
    .slice(-8)
    .map((row) => ({
      sender: row.sender === 'admin' ? 'admin' : 'visitor',
      body: row.body,
    }));
}

/**
 * PATCH /api/chat/messages: 👍 / 👎 on a ProBot answer in the visitor's own chat.
 * Saved on the reply's payload (feedback), for reviewing bad answers.
 */
export async function PATCH(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;
  try {
    const parsed = messageFeedbackSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const cookieDenied = visitorCookieDenied(request, parsed.data.visitorId);
    if (cookieDenied) return cookieDenied;
    const supabase = createServiceRoleClient();
    const { data: message } = await supabase
      .from('probot_messages')
      .select('id, conversation_id, sender, business_id, payload')
      .eq('id', parsed.data.id)
      .maybeSingle();
    if (!message || message.sender !== 'admin' || message.business_id) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    if (!(await visitorOwnsConversation(supabase, message.conversation_id, parsed.data.visitorId))) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }
    const payload = message.payload && typeof message.payload === 'object' && !Array.isArray(message.payload) ? message.payload : {};
    const { error } = await supabase
      .from('probot_messages')
      .update({
        payload: {
          ...(payload as Record<string, unknown>),
          ...(parsed.data.feedback !== undefined ? { feedback: parsed.data.feedback } : {}),
          ...(parsed.data.actionDone && (payload as Record<string, unknown>).proAction
            ? { proAction: { ...((payload as Record<string, unknown>).proAction as Record<string, unknown>), done: true } }
            : {}),
          ...(parsed.data.expenseSavedId && (payload as Record<string, unknown>).expenseDraft
            ? { expenseDraft: { ...((payload as Record<string, unknown>).expenseDraft as Record<string, unknown>), savedExpenseId: parsed.data.expenseSavedId } }
            : {}),
        } as Database['public']['Tables']['probot_messages']['Update']['payload'],
      })
      .eq('id', parsed.data.id);
    if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/chat/messages', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

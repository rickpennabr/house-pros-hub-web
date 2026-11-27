import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/types/supabase';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { adminSendMessageSchema } from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { filterAllowedAttachments } from '@/lib/utils/chatAttachmentAllowlist';
import { chatPushUrl, pushLocaleFromRequest, sendVisitorPushNotification } from '@/lib/services/pushNotificationService';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';
import { snapshotFromRow } from '@/lib/chat/reply-snapshot';
import { fileChatDocOnPlace } from '@/lib/chat/chat-doc-place';

/**
 * POST /api/chat/admin/messages
 * Admin sends a reply in a conversation.
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin =
      !!user.email && user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const body = await request.json();
    const parsed = adminSendMessageSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors?.body?.[0] ?? 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    let { conversationId, body: messageBody, attachments: rawAttachments, replyToId, sentAs, payload: messagePayload } =
      parsed.data;

    const attachments = rawAttachments?.length
      ? filterAllowedAttachments(rawAttachments)
      : undefined;
    if (rawAttachments?.length && attachments === null) {
      return NextResponse.json({ error: 'Invalid attachment URL. Attachments must be uploaded via the chat upload endpoint.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data: conv, error: convError } = await supabase
      .from('probot_conversations')
      .select('id')
      .eq('id', conversationId)
      .single();
    if (convError || !conv) {
      console.error('ProBot admin message conversation lookup:', convError ?? 'not found');
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const userBusinessId = await getOwnedBusinessId(user.id);
    if (!isAdmin) {
      if (!userBusinessId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const [{ data: msgRow }, { data: convOwner }] = await Promise.all([
        supabase
          .from('probot_messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('business_id', userBusinessId)
          .limit(1)
          .maybeSingle(),
        supabase.from('probot_conversations').select('user_id').eq('id', conversationId).maybeSingle(),
      ]);
      // First message to the pro's own personal account: the thread may still be empty.
      if (!msgRow && convOwner?.user_id !== user.id) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      sentAs = { businessId: userBusinessId };
    } else if (userBusinessId && sentAs !== 'hub_agent') {
      // Hub admin who also owns this business: reply as the business in customer→pro threads.
      const { data: msgRow } = await supabase
        .from('probot_messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('business_id', userBusinessId)
        .limit(1)
        .maybeSingle();
      if (msgRow) {
        sentAs = { businessId: userBusinessId };
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

    type InsertPayload = {
      conversation_id: string;
      sender: 'visitor' | 'admin';
      body: string;
      attachments?: unknown;
      reply_to?: unknown;
      admin_sent_as?: 'probot' | 'business' | 'hub_agent';
      business_id?: string;
      admin_user_id?: string;
      payload?: unknown;
    };
    const insertPayload: InsertPayload = {
      conversation_id: conversationId,
      sender: 'admin',
      body: (messageBody ?? '').trim() || ' ',
    };
    if (attachments?.length) insertPayload.attachments = attachments;
    if (replyTo) insertPayload.reply_to = replyTo;
    if (messagePayload?.crmEstimate) {
      insertPayload.payload = {
        crmEstimate: {
          ...messagePayload.crmEstimate,
          depositCents: messagePayload.crmEstimate.depositCents ?? 0,
          status: messagePayload.crmEstimate.status ?? 'sent',
        },
      };
    }
    if (messagePayload?.crmInvoice) {
      const share = messagePayload.crmInvoice;
      insertPayload.payload = {
        crmInvoice: {
          token: share.token,
          invoiceId: share.invoiceId,
          invoiceNumber: share.invoiceNumber,
          amountCents: share.amountCents,
          dueDate: share.dueDate ?? null,
          kind: share.kind,
        },
      };
    }
    // A document card in a customer chat goes on that customer's My Places too (timeline, estimates, invoices).
    const sharedDoc = messagePayload?.crmEstimate
      ? { kind: 'estimate' as const, id: messagePayload.crmEstimate.estimateId }
      : messagePayload?.crmInvoice
        ? { kind: 'invoice' as const, id: messagePayload.crmInvoice.invoiceId }
        : null;
    if (sharedDoc && typeof sentAs === 'object' && sentAs && 'businessId' in sentAs) {
      try {
        const place = await fileChatDocOnPlace(supabase, {
          ownerId: user.id,
          businessId: (sentAs as { businessId: string }).businessId,
          conversationId,
          doc: sharedDoc,
        });
        const docPayload = insertPayload.payload as Record<string, Record<string, unknown>> | undefined;
        const card = docPayload?.crmEstimate ?? docPayload?.crmInvoice;
        if (card && place) card.place = place;
      } catch (err) {
        console.error('[admin messages] file chat document on place', err);
      }
    }
    const invite = (messagePayload as { bookingInvite?: { businessName?: unknown } } | undefined)?.bookingInvite;
    if (invite && typeof sentAs === 'object' && sentAs && 'businessId' in sentAs) {
      // The calendar shared is always the replying business's own.
      insertPayload.payload = {
        bookingInvite: {
          businessId: (sentAs as { businessId: string }).businessId,
          businessName: typeof invite.businessName === 'string' ? invite.businessName.slice(0, 120) : '',
        },
      };
    }
    if (sentAs !== undefined) {
      if (sentAs === 'probot') {
        insertPayload.admin_sent_as = sentAs;
        insertPayload.admin_user_id = user.id;
      } else if (sentAs === 'hub_agent') {
        if (!isAdmin) {
          return NextResponse.json({ error: 'Only admins can reply as Hub Agent' }, { status: 403 });
        }
        insertPayload.admin_sent_as = 'hub_agent';
        insertPayload.admin_user_id = user.id;
      } else {
        insertPayload.admin_sent_as = 'business';
        insertPayload.business_id = sentAs.businessId;
      }
    } else if (isAdmin) {
      // Admin always replies as ProBot; store admin_user_id so their picture shows in the chat
      insertPayload.admin_sent_as = 'probot';
      insertPayload.admin_user_id = user.id;
    }

    type InsertRow = Database['public']['Tables']['probot_messages']['Insert'];
    const selectCols =
      'id, conversation_id, sender, body, created_at, attachments, admin_sent_as, business_id, admin_user_id, payload';
    let result = await supabase
      .from('probot_messages')
      .insert(insertPayload as InsertRow)
      .select(selectCols)
      .single();

    const isColumnError = result.error && (
      result.error.code === '42703' ||
      String(result.error.message).includes('does not exist') ||
      String(result.error.message).includes('column')
    );

    if (result.error && isColumnError && insertPayload.admin_sent_as !== undefined) {
      // Migration 029 (admin_sent_as) is the usual missing column; keep business_id and payload cards.
      delete insertPayload.admin_sent_as;
      result = await supabase
        .from('probot_messages')
        .insert(insertPayload as InsertRow)
        .select('id, conversation_id, sender, body, created_at, attachments, business_id, admin_user_id, payload')
        .single();
    }
    const stillColumnError = result.error && (
      result.error.code === '42703' ||
      String(result.error.message).includes('does not exist') ||
      String(result.error.message).includes('column')
    );

    if (result.error && stillColumnError) {
      console.warn('ProBot admin message insert: retrying without optional columns', result.error);
      // Retry without the newer optional columns (migrations 028/029/040 may not be applied).
      // Never drop business_id: without it a pro's reply lands in the customer's ProBot chat.
      delete insertPayload.reply_to;
      delete insertPayload.attachments;
      delete insertPayload.admin_sent_as;
      delete insertPayload.admin_user_id;
      delete insertPayload.payload;
      const colsFallback = 'id, conversation_id, sender, body, created_at, business_id';
      result = await supabase
        .from('probot_messages')
        .insert(insertPayload as InsertRow)
        .select(colsFallback)
        .single();
      if (result.data) {
        const d = result.data as unknown as Record<string, unknown>;
        d.attachments = attachments ?? [];
        d.admin_sent_as = sentAs === 'probot' ? sentAs : sentAs === 'hub_agent' ? 'hub_agent' : 'probot';
        d.business_id = d.business_id ?? (typeof sentAs === 'object' && sentAs && 'businessId' in sentAs ? (sentAs as { businessId: string }).businessId : undefined);
        d.admin_user_id = sentAs === 'hub_agent' ? user.id : undefined;
      }
    }

    if (result.error) {
      console.error('ProBot admin message insert error:', result.error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    const message = result.data as unknown as {
      id: string;
      conversation_id: string;
      sender: string;
      body: string;
      created_at: string;
      attachments?: unknown;
      admin_sent_as?: string | null;
      business_id?: string | null;
      admin_user_id?: string | null;
      payload?: unknown;
    };
    let admin_avatar_url: string | undefined;
    let admin_display_name: string | undefined;
    if (message.admin_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, user_picture')
        .eq('id', message.admin_user_id)
        .single();
      if (profile) {
        const p = profile as { first_name?: string | null; last_name?: string | null; user_picture?: string | null };
        admin_avatar_url = p.user_picture ?? undefined;
        admin_display_name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || undefined;
      }
    }
    if (message.admin_sent_as === 'hub_agent') {
      await supabase
        .from('probot_conversations')
        .update({ agent_paused_at: new Date().toISOString() })
        .eq('id', conversationId);
      await supabase
        .from('probot_agent_steps')
        .update({ status: 'failed', output: { reason: 'superseded' } })
        .eq('conversation_id', conversationId)
        .eq('status', 'needs_confirm');
    }

    const pushBody = (messageBody ?? '').trim().slice(0, 80) + ((messageBody ?? '').trim().length > 80 ? '…' : '');
    await sendVisitorPushNotification(
      conversationId,
      'New reply in ProBot',
      pushBody || 'You have a new message',
      chatPushUrl(pushLocaleFromRequest(request), 'personal')
    );

    return NextResponse.json(
      {
        message: {
          id: message.id,
          conversationId: message.conversation_id,
          sender: message.sender,
          body: message.body,
          created_at: message.created_at,
          attachments: message.attachments ?? attachments ?? [],
          replyTo: replyTo ?? undefined,
          admin_sent_as: message.admin_sent_as ?? undefined,
          business_id: message.business_id ?? undefined,
          admin_user_id: message.admin_user_id ?? undefined,
          admin_avatar_url,
          admin_display_name,
          payload: message.payload ?? messagePayload ?? undefined,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('ProBot admin messages POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

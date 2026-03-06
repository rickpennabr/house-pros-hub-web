import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/types/supabase';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { adminSendMessageSchema } from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { filterAllowedAttachments } from '@/lib/utils/chatAttachmentAllowlist';
import { sendVisitorPushNotification } from '@/lib/services/pushNotificationService';

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
    let { conversationId, body: messageBody, attachments: rawAttachments, sentAs } = parsed.data;

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

    if (!isAdmin) {
      const { data: profile } = await supabaseAuth
        .from('profiles')
        .select('business_id')
        .eq('id', user.id)
        .single();
      const userBusinessId = (profile as { business_id?: string } | null)?.business_id ?? null;
      if (!userBusinessId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { data: msgRow } = await supabase
        .from('probot_messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('business_id', userBusinessId)
        .limit(1)
        .maybeSingle();
      if (!msgRow) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      sentAs = { businessId: userBusinessId };
    }

    type InsertPayload = {
      conversation_id: string;
      sender: 'visitor' | 'admin';
      body: string;
      attachments?: unknown;
      admin_sent_as?: 'probot' | 'business' | 'hub_agent';
      business_id?: string;
      admin_user_id?: string;
    };
    const insertPayload: InsertPayload = {
      conversation_id: conversationId,
      sender: 'admin',
      body: (messageBody ?? '').trim() || ' ',
    };
    if (attachments?.length) insertPayload.attachments = attachments;
    if (sentAs !== undefined) {
      if (sentAs === 'probot') {
        insertPayload.admin_sent_as = sentAs;
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
      // Admin replies always show as ProBot in contacts/history when no identity specified
      insertPayload.admin_sent_as = 'probot';
    }

    type InsertRow = Database['public']['Tables']['probot_messages']['Insert'];
    const selectCols = 'id, conversation_id, sender, body, created_at, attachments, admin_sent_as, business_id, admin_user_id';
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

    if (result.error && isColumnError) {
      // Retry without optional columns (migrations 028/029/040 may not be applied)
      delete insertPayload.attachments;
      delete insertPayload.admin_sent_as;
      delete insertPayload.business_id;
      delete insertPayload.admin_user_id;
      const colsFallback = 'id, conversation_id, sender, body, created_at';
      result = await supabase
        .from('probot_messages')
        .insert(insertPayload as InsertRow)
        .select(colsFallback)
        .single();
      if (result.data) {
        const d = result.data as unknown as Record<string, unknown>;
        d.attachments = attachments ?? [];
        d.admin_sent_as = sentAs === 'probot' ? sentAs : sentAs === 'hub_agent' ? 'hub_agent' : 'probot';
        d.business_id = typeof sentAs === 'object' && sentAs && 'businessId' in sentAs ? (sentAs as { businessId: string }).businessId : undefined;
        d.admin_user_id = sentAs === 'hub_agent' ? user.id : undefined;
      }
    }

    if (result.error) {
      console.error('ProBot admin message insert error:', result.error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    const message = result.data as unknown as { id: string; conversation_id: string; sender: string; body: string; created_at: string; attachments?: unknown; admin_sent_as?: string | null; business_id?: string | null; admin_user_id?: string | null };
    let admin_avatar_url: string | undefined;
    let admin_display_name: string | undefined;
    if (message.admin_sent_as === 'hub_agent' && message.admin_user_id) {
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
    const pushBody = (messageBody ?? '').trim().slice(0, 80) + ((messageBody ?? '').trim().length > 80 ? '…' : '');
    await sendVisitorPushNotification(
      conversationId,
      'New reply in ProBot',
      pushBody || 'You have a new message',
      '/'
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
          admin_sent_as: message.admin_sent_as ?? undefined,
          business_id: message.business_id ?? undefined,
          admin_user_id: message.admin_user_id ?? undefined,
          admin_avatar_url,
          admin_display_name,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('ProBot admin messages POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

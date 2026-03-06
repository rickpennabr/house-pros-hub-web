import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/types/supabase';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { sendMessageSchema, getMessagesSchema } from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { filterAllowedAttachments } from '@/lib/utils/chatAttachmentAllowlist';
import { sendAdminPushNotification, sendBusinessPushNotification } from '@/lib/services/pushNotificationService';

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
    const { conversationId: providedConvId, visitorId, body: messageBody, businessId, displayName, userId, attachments: rawAttachments } = parsed.data;

    const attachments = rawAttachments?.length
      ? filterAllowedAttachments(rawAttachments)
      : undefined;
    if (rawAttachments?.length && attachments === null) {
      return NextResponse.json({ error: 'Invalid attachment URL. Attachments must be uploaded via the chat upload endpoint.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    let conversationId = providedConvId;

    if (!conversationId) {
      const { data: existing } = await supabase
        .from('probot_conversations')
        .select('id')
        .eq('visitor_id', visitorId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        conversationId = (existing as { id: string }).id;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('probot_conversations')
          .insert({ visitor_id: visitorId })
          .select('id')
          .single();
        if (insertErr || !inserted) {
          console.error('ProBot conversation insert error:', insertErr);
          return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
        }
        conversationId = inserted.id;
      }
    } else {
      const { data: conv } = await supabase
        .from('probot_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('visitor_id', visitorId)
        .single();
      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    const insertPayload: {
      conversation_id: string;
      sender: 'visitor' | 'admin';
      body: string;
      business_id?: string;
      attachments?: unknown;
    } = {
      conversation_id: conversationId,
      sender: 'visitor',
      body: (messageBody ?? '').trim() || ' ',
    };
    if (businessId) insertPayload.business_id = businessId;
    if (attachments?.length) insertPayload.attachments = attachments;

    const selectCols = 'id, conversation_id, sender, body, created_at, attachments';

    type InsertRow = Database['public']['Tables']['probot_messages']['Insert'];
    let result = await supabase
      .from('probot_messages')
      .insert(insertPayload as InsertRow)
      .select(selectCols)
      .single();

    if (result.error && (result.error.code === '42703' || String(result.error.message).includes('does not exist'))) {
      delete insertPayload.attachments;
      const colsWithoutAttachments = 'id, conversation_id, sender, body, created_at';
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

    const pushTitle = businessId ? 'New message to a Pro' : 'New ProBot message';
    const pushBody = messageBody.slice(0, 80) + (messageBody.length > 80 ? '…' : '');
    await sendAdminPushNotification(pushTitle, pushBody, '/admin/chat');
    if (businessId) {
      await sendBusinessPushNotification(businessId, pushTitle, pushBody, '/probot');
    }

    const msg = message as unknown as { id: string; conversation_id: string; sender: string; body: string; created_at: string; attachments?: unknown };
    return NextResponse.json(
      {
        message: {
          id: msg.id,
          conversationId: msg.conversation_id,
          sender: msg.sender,
          body: msg.body,
          created_at: msg.created_at,
          businessId: businessId ?? undefined,
          attachments: msg.attachments ?? attachments ?? [],
        },
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
export async function GET(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const visitorId = searchParams.get('visitorId') ?? undefined;
    const parsed = getMessagesSchema.safeParse({ conversationId, visitorId });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const supabaseServer = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser();
    const isAdmin =
      !userError &&
      !!user?.email &&
      user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const supabase = createServiceRoleClient();

    let contractorReadBusinessId: string | null = null;
    if (!isAdmin) {
      if (visitorId) {
        const { data: conv } = await supabase
          .from('probot_conversations')
          .select('id')
          .eq('id', parsed.data.conversationId)
          .eq('visitor_id', visitorId)
          .single();
        if (!conv) {
          return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }
      } else {
        if (!user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { data: profile } = await supabaseServer
          .from('profiles')
          .select('business_id')
          .eq('id', user.id)
          .single();
        const userBusinessId = (profile as { business_id?: string } | null)?.business_id ?? null;
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
    }

    // WhatsApp-style: one thread per profile. For admin/contractor, load messages from all conversations for this visitor and merge.
    let conversationIds: string[] = [parsed.data.conversationId];
    const isVisitorContext = Boolean(parsed.data.visitorId?.trim());
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

    type MessageRow = { id: string; sender: string; body: string; created_at: string; business_id?: string | null; read_at?: string | null; attachments?: unknown; admin_sent_as?: string | null; admin_user_id?: string | null };
    let rawMessages: MessageRow[] | null = null;

    const selectCols = 'id, sender, body, created_at, business_id, read_at, attachments, admin_sent_as, admin_user_id';
    const withAttachments = await supabase
      .from('probot_messages')
      .select(selectCols)
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true })
      .limit(300);

    if (!withAttachments.error) {
      rawMessages = withAttachments.data as unknown as MessageRow[] | null;
    } else if (withAttachments.error.code === '42703' || String(withAttachments.error.message).includes('does not exist')) {
      const withoutAdminUserId = await supabase
        .from('probot_messages')
        .select('id, sender, body, created_at, business_id, read_at, attachments, admin_sent_as')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true })
        .limit(300);
      if (!withoutAdminUserId.error) {
        rawMessages = (withoutAdminUserId.data ?? []).map((m) => ({ ...m, admin_user_id: null })) as MessageRow[];
      } else {
        const withReadAt = await supabase
          .from('probot_messages')
          .select('id, sender, body, created_at, business_id, read_at, admin_sent_as')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: true })
          .limit(300);
        if (!withReadAt.error) {
          rawMessages = (withReadAt.data ?? []).map((m) => ({ ...m, attachments: [], admin_user_id: null })) as MessageRow[];
        } else {
          const min = await supabase
            .from('probot_messages')
            .select('id, sender, body, created_at, business_id')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: true })
            .limit(300);
          if (min.error) {
            console.error('ProBot messages GET error:', min.error);
            return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
          }
          const minData = min.data ?? [];
          rawMessages = minData.map((m) => ({
            ...m,
            business_id: m.business_id ?? null,
            read_at: null,
            attachments: [],
            admin_sent_as: null,
            admin_user_id: null,
          })) as MessageRow[];
        }
      }
    } else {
      console.error('ProBot messages GET error:', withAttachments.error);
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    let rows = rawMessages ?? [];
    if (contractorReadBusinessId) {
      rows = rows.filter(
        (m) => m.sender === 'admin' || m.business_id === contractorReadBusinessId
      );
    }

    // Mark as read by context: visitor viewing (has visitorId) = mark admin messages read only;
    // admin/contractor viewing = mark visitor messages read across all conversations in this thread (WhatsApp-style one thread per profile).
    const nowIso = new Date().toISOString();
    let readAtUpdated = false;
    if (isVisitorContext) {
      const up = await supabase
        .from('probot_messages')
        .update({ read_at: nowIso })
        .eq('conversation_id', parsed.data.conversationId)
        .eq('sender', 'admin')
        .is('read_at', null);
      readAtUpdated = !up.error || up.error.code !== '42703';
    } else {
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

    const businessIds = [...new Set(rows.map((m) => m.business_id).filter(Boolean))] as string[];
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

    const adminUserIds = [...new Set(rows.filter((m) => m.sender === 'admin' && m.admin_sent_as === 'hub_agent' && m.admin_user_id).map((m) => m.admin_user_id!))];
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
        admin_sent_as: m.admin_sent_as ?? undefined,
        admin_user_id: adminUserId,
        admin_avatar_url: adminProfile?.admin_avatar_url ?? undefined,
        admin_display_name: adminProfile?.admin_display_name ?? undefined,
      };
    });
    return NextResponse.json({ messages }, { status: 200 });
  } catch (e) {
    console.error('ProBot messages GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

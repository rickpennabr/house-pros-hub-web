import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { sendMessageSchema, getMessagesSchema } from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { sendAdminPushNotification } from '@/lib/services/pushNotificationService';

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
    const { conversationId: providedConvId, visitorId, body: messageBody, businessId } = parsed.data;

    const supabase = createServiceRoleClient();
    let conversationId = providedConvId;

    if (!conversationId) {
      const { data: existing } = await supabase
        .from('probot_conversations')
        .select('id')
        .eq('visitor_id', visitorId)
        .single();
      if (existing) {
        conversationId = existing.id;
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

    const insertPayload: { conversation_id: string; sender: 'visitor' | 'admin'; body: string; business_id?: string } = {
      conversation_id: conversationId,
      sender: 'visitor',
      body: messageBody,
    };
    if (businessId) insertPayload.business_id = businessId;

    // Select only columns that exist without migration 018 (business_id may not exist yet)
    const selectCols = 'id, conversation_id, sender, body, created_at';

    let result = await supabase
      .from('probot_messages')
      .insert(insertPayload)
      .select(selectCols)
      .single();

    if (result.error && (result.error.code === '42703' || String(result.error.message).includes('does not exist'))) {
      delete insertPayload.business_id;
      result = await supabase
        .from('probot_messages')
        .insert(insertPayload)
        .select(selectCols)
        .single();
    }

    if (result.error) {
      console.error('ProBot message insert error:', result.error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    const message = result.data;

    const pushTitle = businessId ? 'New message to a Pro' : 'New ProBot message';
    await sendAdminPushNotification(
      pushTitle,
      messageBody.slice(0, 80) + (messageBody.length > 80 ? '…' : ''),
      '/admin/chat'
    );

    return NextResponse.json(
      { message: { id: message.id, conversationId: message.conversation_id, sender: message.sender, body: message.body, created_at: message.created_at, businessId: businessId ?? undefined } },
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
      data: { session },
    } = await supabaseServer.auth.getSession();
    const isAdmin =
      !!session?.user?.email &&
      session.user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const supabase = createServiceRoleClient();

    if (!isAdmin) {
      if (!visitorId) {
        return NextResponse.json({ error: 'visitorId required for visitor' }, { status: 400 });
      }
      const { data: conv } = await supabase
        .from('probot_conversations')
        .select('id')
        .eq('id', parsed.data.conversationId)
        .eq('visitor_id', visitorId)
        .single();
      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    // Select messages; business_id may not exist if migration 018 not run yet
    let rawMessages: { id: string; sender: string; body: string; created_at: string; business_id?: string | null }[] | null = null;

    const withBusinessId = await supabase
      .from('probot_messages')
      .select('id, sender, body, created_at, business_id')
      .eq('conversation_id', parsed.data.conversationId)
      .order('created_at', { ascending: true })
      .limit(100);

    type MessageRow = { id: string; sender: string; body: string; created_at: string; business_id?: string | null };
    if (withBusinessId.error) {
      // Fallback: column business_id may not exist yet (migration 018 not applied)
      const fallback = await supabase
        .from('probot_messages')
        .select('id, sender, body, created_at')
        .eq('conversation_id', parsed.data.conversationId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (fallback.error) {
        console.error('ProBot messages GET error:', fallback.error);
        return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
      }
      rawMessages = fallback.data as unknown as MessageRow[] | null;
    } else {
      rawMessages = withBusinessId.data as unknown as MessageRow[] | null;
    }

    const rows = rawMessages ?? [];
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

    const messages = rows.map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      created_at: m.created_at,
      business_id: m.business_id ?? undefined,
      business_name: m.business_id ? businessNames[m.business_id] : undefined,
    }));
    return NextResponse.json({ messages }, { status: 200 });
  } catch (e) {
    console.error('ProBot messages GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

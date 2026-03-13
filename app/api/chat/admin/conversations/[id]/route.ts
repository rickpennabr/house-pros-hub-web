import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { adminConversationIdSchema } from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

type ConvRow = {
  id: string;
  visitor_id: string;
  created_at: string;
  updated_at: string;
  visitor_display_name?: string | null;
  user_id?: string | null;
};

/**
 * GET /api/chat/admin/conversations/[id]
 * Returns a single conversation by id. Admin can access any; contractor only if conversation involves their business.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const { id: rawId } = await params;
    const parsed = adminConversationIdSchema.safeParse(rawId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 });
    }
    const conversationId = parsed.data;

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
    let userBusinessId: string | null = null;
    if (!isAdmin) {
      const { data: profile } = await supabaseAuth
        .from('profiles')
        .select('business_id')
        .eq('id', user.id)
        .single();
      userBusinessId = (profile as { business_id?: string } | null)?.business_id ?? null;
    }

    const supabase = createServiceRoleClient();
    const { data: adminUsers } = await supabase.from('admin_users').select('user_id');
    const adminUserIdsSet = new Set<string>(((adminUsers ?? []) as { user_id: string }[]).map((r) => r.user_id));

    const { data: conv, error: convError } = await supabase
      .from('probot_conversations')
      .select('id, visitor_id, created_at, updated_at, visitor_display_name, user_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const row: ConvRow = conv;

    if (!isAdmin) {
      if (!userBusinessId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { data: msgRow } = await supabase
        .from('probot_messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('business_id', userBusinessId)
        .limit(1)
        .single();
      if (!msgRow) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    const convIds = [row.id];
    type MsgRow = { conversation_id: string; sender: string; business_id?: string | null };
    const { data: messagesByConv } = await supabase
      .from('probot_messages')
      .select('conversation_id, sender, business_id')
      .in('conversation_id', convIds);
    const messagesList = (messagesByConv ?? []) as unknown as MsgRow[];
    const hasAnyMessageByConv = new Map<string, boolean>();
    const businessIdByConv = new Map<string, string>();
    for (const m of messagesList) {
      hasAnyMessageByConv.set(m.conversation_id, true);
      if (m.business_id) businessIdByConv.set(m.conversation_id, m.business_id);
    }

    const businessIds = [...new Set(businessIdByConv.values())];
    const businessNames: Record<string, string> = {};
    const businessLogos: Record<string, string | null> = {};
    if (businessIds.length > 0) {
      const { data: bizRows } = await supabase
        .from('businesses')
        .select('id, business_name, business_logo')
        .in('id', businessIds);
      for (const b of bizRows ?? []) {
        const r = b as { id: string; business_name: string | null; business_logo: string | null };
        businessNames[r.id] = r.business_name ?? r.id;
        businessLogos[r.id] = r.business_logo ?? null;
      }
    }

    const profileByUserId: Record<string, { first_name: string | null; last_name: string | null; user_picture: string | null }> = {};
    if (row.user_id) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_picture')
        .eq('id', row.user_id)
        .single();
      if (profileRows) {
        const p = profileRows as { id: string; first_name: string | null; last_name: string | null; user_picture: string | null };
        profileByUserId[p.id] = p;
      }
    }

    const { data: presenceRows } = await supabase
      .from('chat_presence')
      .select('visitor_id, last_seen_at')
      .eq('visitor_id', row.visitor_id)
      .maybeSingle();
    const lastSeenAt = (presenceRows as { last_seen_at?: string } | null)?.last_seen_at ?? null;
    const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
    const visitorOnline = lastSeenAt
      ? new Date(lastSeenAt).getTime() > Date.now() - ONLINE_THRESHOLD_MS
      : false;

    type LastMsg = { conversation_id: string; body: string | null; created_at: string; sender: string };
    type FirstVisitorMsg = { conversation_id: string; body: string | null; created_at: string };
    type UnreadRow = { conversation_id: string };

    const [lastMsgRes, firstVisitorRes, unreadRes] = await Promise.all([
      supabase
        .from('probot_messages')
        .select('conversation_id, body, created_at, sender')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('probot_messages')
        .select('conversation_id, body, created_at')
        .eq('conversation_id', conversationId)
        .eq('sender', 'visitor')
        .order('created_at', { ascending: true })
        .limit(1),
      supabase
        .from('probot_messages')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('sender', 'visitor')
        .is('read_at', null),
    ]);

    const last = (lastMsgRes.data ?? [])[0] as LastMsg | undefined;
    const firstVisitor = (firstVisitorRes.data ?? [])[0] as FirstVisitorMsg | undefined;
    const unreadCount = (unreadRes.data ?? []) as UnreadRow[];

    const bid = businessIdByConv.get(row.id);
    const participant_type = bid ? ('contractor' as const) : ('customer' as const);
    const business_name = bid ? businessNames[bid] : undefined;
    const business_logo = bid ? (businessLogos[bid] ?? undefined) : undefined;
    const business_id = bid ?? undefined;
    const profile = row.user_id ? profileByUserId[row.user_id] : undefined;
    // When the "visitor" is any admin, show as ProBot only (one bot in History/header, never personal name/photo)
    const display_as_probot = row.user_id != null && adminUserIdsSet.has(row.user_id);
    const conversation = {
      ...row,
      lastMessage: last ? { body: last.body ?? '', created_at: last.created_at, sender: last.sender } : null,
      firstVisitorMessage: firstVisitor ? { body: firstVisitor.body ?? '', created_at: firstVisitor.created_at } : null,
      unread_count: unreadCount.length,
      last_seen_at: lastSeenAt,
      visitor_online: visitorOnline,
      participant_type,
      business_name,
      business_id,
      business_logo,
      visitor_display_name: display_as_probot ? undefined : (row.visitor_display_name?.trim() || undefined),
      profile_first_name: display_as_probot ? undefined : (profile?.first_name?.trim() || undefined),
      profile_last_name: display_as_probot ? undefined : (profile?.last_name?.trim() || undefined),
      profile_user_picture: display_as_probot ? undefined : (profile?.user_picture?.trim() || undefined),
      display_as_probot,
    };

    return NextResponse.json({ conversation }, { status: 200 });
  } catch (e) {
    console.error('ProBot admin conversation GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

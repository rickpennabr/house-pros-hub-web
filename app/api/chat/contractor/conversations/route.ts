import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

type ConvRow = {
  id: string;
  visitor_id: string;
  created_at: string;
  updated_at: string;
  visitor_display_name?: string | null;
  user_id?: string | null;
};

/**
 * GET /api/chat/contractor/conversations
 * Returns recent conversations for the current user's business (messages where business_id = their business).
 * Same shape as admin conversations so History Chat sidebar can show the list.
 */
export async function GET(request: NextRequest) {
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

    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();
    const userBusinessId = (profile as { business_id?: string } | null)?.business_id ?? null;
    if (!userBusinessId) {
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    const supabase = createServiceRoleClient();

    // Conversation IDs that have at least one message to this business
    const { data: msgRows } = await supabase
      .from('probot_messages')
      .select('conversation_id')
      .eq('business_id', userBusinessId)
      .limit(500);
    const convIds = [...new Set((msgRows ?? []).map((m) => (m as { conversation_id: string }).conversation_id))];
    if (convIds.length === 0) {
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    const { data: convList, error: convError } = await supabase
      .from('probot_conversations')
      .select('id, visitor_id, created_at, updated_at, visitor_display_name, user_id')
      .in('id', convIds)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (convError || !convList?.length) {
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    const list = convList as ConvRow[];
    const listConvIds = list.map((c) => c.id);

    type LastMsg = { conversation_id: string; body: string | null; created_at: string; sender: string };
    type FirstVisitorMsg = { conversation_id: string; body: string | null; created_at: string };
    type UnreadRow = { conversation_id: string };

    const [lastMsgRes, firstVisitorRes, unreadRowsRes] = await Promise.all([
      supabase
        .from('probot_messages')
        .select('conversation_id, body, created_at, sender')
        .in('conversation_id', listConvIds)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('probot_messages')
        .select('conversation_id, body, created_at')
        .in('conversation_id', listConvIds)
        .eq('sender', 'visitor')
        .order('created_at', { ascending: true })
        .limit(2000),
      supabase
        .from('probot_messages')
        .select('conversation_id')
        .in('conversation_id', listConvIds)
        .eq('sender', 'visitor')
        .eq('business_id', userBusinessId)
        .is('read_at', null),
    ]);

    const lastByConv = new Map<string, { body: string; created_at: string; sender: string }>();
    for (const r of (lastMsgRes.data ?? []) as LastMsg[]) {
      if (!lastByConv.has(r.conversation_id)) {
        lastByConv.set(r.conversation_id, { body: r.body ?? '', created_at: r.created_at, sender: r.sender });
      }
    }
    const firstVisitorByConv = new Map<string, { body: string; created_at: string }>();
    for (const r of (firstVisitorRes.data ?? []) as FirstVisitorMsg[]) {
      if (!firstVisitorByConv.has(r.conversation_id)) {
        firstVisitorByConv.set(r.conversation_id, { body: r.body ?? '', created_at: r.created_at });
      }
    }
    const unreadCountByConv = new Map<string, number>();
    for (const r of (unreadRowsRes.data ?? []) as UnreadRow[]) {
      unreadCountByConv.set(r.conversation_id, (unreadCountByConv.get(r.conversation_id) ?? 0) + 1);
    }

    const userIds = [...new Set(list.map((c) => c.user_id).filter(Boolean))] as string[];
    type ProfileRow = { id: string; first_name: string | null; last_name: string | null; user_picture: string | null };
    const profileByUserId: Record<string, ProfileRow> = {};
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_picture')
        .in('id', userIds);
      for (const p of profileRows ?? []) {
        const row = p as ProfileRow;
        profileByUserId[row.id] = row;
      }
    }

    const { data: adminUsers } = await supabase.from('admin_users').select('user_id');
    const adminUserIdsSet = new Set<string>(((adminUsers ?? []) as { user_id: string }[]).map((r) => r.user_id));

    type ConversationItem = {
      id: string;
      visitor_id: string;
      created_at: string;
      updated_at: string;
      visitor_display_name?: string;
      user_id?: string | null;
      lastMessage: { body: string; created_at: string; sender: string } | null;
      firstVisitorMessage: { body: string; created_at: string } | null;
      unread_count: number;
      participant_type: 'customer';
      profile_first_name?: string;
      profile_last_name?: string;
      profile_user_picture?: string | null;
      display_as_probot?: boolean;
      _lastActivityAt?: string;
    };

    const mapped = list.map((row): ConversationItem => {
      const last = lastByConv.get(row.id);
      const firstVisitor = firstVisitorByConv.get(row.id);
      const unread_count = unreadCountByConv.get(row.id) ?? 0;
      const profile = row.user_id ? profileByUserId[row.user_id] : undefined;
      const profile_first_name = profile?.first_name?.trim() || undefined;
      const profile_last_name = profile?.last_name?.trim() || undefined;
      const profile_user_picture = profile?.user_picture?.trim() || undefined;
      const visitor_display_name = row.visitor_display_name?.trim() || undefined;
      const lastActivityAt = last?.created_at ?? row.updated_at;
      const display_as_probot = row.user_id ? adminUserIdsSet.has(row.user_id) : false;
      return {
        id: row.id,
        visitor_id: row.visitor_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        visitor_display_name,
        user_id: row.user_id,
        lastMessage: last ? { body: last.body, created_at: last.created_at, sender: last.sender } : null,
        firstVisitorMessage: firstVisitor ? { body: firstVisitor.body, created_at: firstVisitor.created_at } : null,
        unread_count,
        participant_type: 'customer' as const,
        profile_first_name,
        profile_last_name,
        profile_user_picture,
        display_as_probot,
        _lastActivityAt: lastActivityAt,
      };
    });

    // WhatsApp-style: one chat per profile (visitor_id). Group by visitor_id, keep primary (most recent), aggregate unread and latest message.
    const byVisitor = new Map<string, ConversationItem[]>();
    for (const item of mapped) {
      const v = item.visitor_id;
      if (!byVisitor.has(v)) byVisitor.set(v, []);
      byVisitor.get(v)!.push(item);
    }
    const conversations: Omit<ConversationItem, '_lastActivityAt'>[] = [];
    for (const items of byVisitor.values()) {
      items.sort((a, b) => new Date((b._lastActivityAt ?? b.updated_at)).getTime() - new Date((a._lastActivityAt ?? a.updated_at)).getTime());
      const primary = items[0]!;
      const latestMessage = primary.lastMessage;
      const earliestFirst = items.reduce(
        (acc, i) => {
          const f = i.firstVisitorMessage;
          if (!f) return acc;
          if (!acc || new Date(f.created_at).getTime() < new Date(acc.created_at).getTime()) return f;
          return acc;
        },
        null as { body: string; created_at: string } | null
      );
      const totalUnread = items.reduce((sum, i) => sum + i.unread_count, 0);
      const { _lastActivityAt, ...rest } = primary;
      conversations.push({
        ...rest,
        lastMessage: latestMessage,
        firstVisitorMessage: earliestFirst ?? primary.firstVisitorMessage,
        unread_count: totalUnread,
      });
    }
    conversations.sort((a, b) => {
      const at = a.lastMessage?.created_at ?? a.updated_at;
      const bt = b.lastMessage?.created_at ?? b.updated_at;
      return new Date(bt).getTime() - new Date(at).getTime();
    });

    return NextResponse.json({ conversations }, { status: 200 });
  } catch (e) {
    console.error('GET /api/chat/contractor/conversations error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import type { NextRequest } from 'next/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * GET /api/chat/admin/conversations
 * List all ProBot conversations for admin. Ensures admin is in admin_users for Realtime.
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

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin =
      user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    await supabase.from('admin_users').upsert(
      { user_id: user.id },
      { onConflict: 'user_id' }
    );

    // All admin user ids: conversations where the "visitor" is any admin show as ProBot (one bot) in History
    type AdminUserRow = { user_id: string };
    const { data: adminUsers } = await supabase.from('admin_users').select('user_id');
    const adminUserIdsSet = new Set<string>(((adminUsers ?? []) as AdminUserRow[]).map((r) => r.user_id));

    let convList: ConvRow[] = [];
    type ConvRow = { id: string; visitor_id: string; created_at: string; updated_at: string; visitor_display_name?: string | null; user_id?: string | null };
    const convRes = await supabase
      .from('probot_conversations')
      .select('id, visitor_id, created_at, updated_at, visitor_display_name, user_id')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (!convRes.error) {
      convList = (convRes.data ?? []) as ConvRow[];
    } else if (convRes.error.code === '42703' || String(convRes.error.message).includes('does not exist')) {
      const fallback = await supabase
        .from('probot_conversations')
        .select('id, visitor_id, created_at, updated_at, visitor_display_name')
        .order('updated_at', { ascending: false })
        .limit(100);
      if (fallback.error) {
        const minimal = await supabase
          .from('probot_conversations')
          .select('id, visitor_id, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(100);
        if (minimal.error) {
          console.error('ProBot admin conversations GET error:', minimal.error);
          return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 });
        }
        convList = ((minimal.data ?? []) as Omit<ConvRow, 'visitor_display_name' | 'user_id'>[]).map((r) => ({ ...r, visitor_display_name: null, user_id: null }));
      } else {
        convList = ((fallback.data ?? []) as Omit<ConvRow, 'user_id'>[]).map((r) => ({ ...r, user_id: null }));
      }
    } else {
      console.error('ProBot admin conversations GET error:', convRes.error);
      return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 });
    }
    const convIds = convList.map((c) => (c as ConvRow).id);

    // Messages per conversation: has admin (ProBot) message? any business_id? (for Customer vs Contractor)
    type MsgRow = { conversation_id: string; sender: string; business_id?: string | null };
    let messagesByConv: MsgRow[] = [];
    const msgRes = await supabase
      .from('probot_messages')
      .select('conversation_id, sender, business_id')
      .in('conversation_id', convIds);
    if (!msgRes.error) {
      messagesByConv = (msgRes.data ?? []) as unknown as MsgRow[];
    } else if (msgRes.error.code === '42703' || String(msgRes.error.message).includes('does not exist')) {
      const fallback = await supabase
        .from('probot_messages')
        .select('conversation_id, sender')
        .in('conversation_id', convIds);
      if (!fallback.error) {
        messagesByConv = (fallback.data ?? []).map((m) => ({ ...m, business_id: null })) as unknown as MsgRow[];
      }
    }

    const hasAnyMessageByConv = new Map<string, boolean>();
    const businessIdByConv = new Map<string, string>();
    for (const m of messagesByConv) {
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
        const row = b as { id: string; business_name: string | null; business_logo: string | null };
        businessNames[row.id] = row.business_name ?? row.id;
        businessLogos[row.id] = row.business_logo ?? null;
      }
    }

    const userIds = [...new Set(convList.map((c) => (c as ConvRow).user_id).filter(Boolean))] as string[];
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

    const visitorIds = [...new Set(convList.map((c) => (c as { visitor_id: string }).visitor_id))];
    const { data: presenceRows } = visitorIds.length > 0
      ? await supabase
          .from('chat_presence')
          .select('visitor_id, last_seen_at')
          .in('visitor_id', visitorIds)
          .not('visitor_id', 'is', null)
      : { data: [] as { visitor_id: string; last_seen_at: string }[] | null };
    const lastSeenByVisitor = new Map<string, string>(
      (presenceRows ?? []).map((r) => [(r as { visitor_id: string; last_seen_at: string }).visitor_id, (r as { visitor_id: string; last_seen_at: string }).last_seen_at])
    );

    const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
    const convIdsWithMessages = convIds.filter((id) => hasAnyMessageByConv.get(id));
    if (convIdsWithMessages.length === 0) {
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    // Batch fetch: last message, first visitor message, and unread counts per conversation (3 queries instead of 3N)
    type LastMsg = { conversation_id: string; body: string | null; created_at: string; sender: string };
    type FirstVisitorMsg = { conversation_id: string; body: string | null; created_at: string };
    type UnreadRow = { conversation_id: string };

    const [lastMsgRes, firstVisitorRes, unreadRowsRes] = await Promise.all([
      supabase
        .from('probot_messages')
        .select('conversation_id, body, created_at, sender')
        .in('conversation_id', convIdsWithMessages)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('probot_messages')
        .select('conversation_id, body, created_at')
        .in('conversation_id', convIdsWithMessages)
        .eq('sender', 'visitor')
        .order('created_at', { ascending: true })
        .limit(2000),
      supabase
        .from('probot_messages')
        .select('conversation_id')
        .in('conversation_id', convIdsWithMessages)
        .eq('sender', 'visitor')
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

    const withLastMessage = convList
      .filter((c) => hasAnyMessageByConv.get((c as { id: string }).id))
      .map((c) => {
        const row = c as ConvRow;
        const last = lastByConv.get(row.id);
        const firstVisitor = firstVisitorByConv.get(row.id);
        const unread_count = unreadCountByConv.get(row.id) ?? 0;
        const lastSeenAt = lastSeenByVisitor.get(row.visitor_id) ?? null;
        const visitorOnline = lastSeenAt
          ? new Date(lastSeenAt).getTime() > Date.now() - ONLINE_THRESHOLD_MS
          : false;
        const bid = businessIdByConv.get(row.id);
        const participant_type = bid ? ('contractor' as const) : ('customer' as const);
        const business_name = bid ? businessNames[bid] : undefined;
        const business_logo = bid ? (businessLogos[bid] ?? undefined) : undefined;
        const business_id = bid ?? undefined;
        const visitor_display_name = row.visitor_display_name?.trim() || undefined;
        const profile = row.user_id ? profileByUserId[row.user_id] : undefined;
        const profile_first_name = profile?.first_name?.trim() || undefined;
        const profile_last_name = profile?.last_name?.trim() || undefined;
        const profile_user_picture = profile?.user_picture?.trim() || undefined;
        // When the "visitor" in this conversation is any admin, show as ProBot only (one bot in History, never personal name/photo)
        const display_as_probot = row.user_id != null && adminUserIdsSet.has(row.user_id);
        const lastActivityAt = last?.created_at ?? row.updated_at;
        return {
          ...row,
          lastMessage: last ? { body: last.body, created_at: last.created_at, sender: last.sender } : null,
          firstVisitorMessage: firstVisitor ? { body: firstVisitor.body, created_at: firstVisitor.created_at } : null,
          unread_count,
          last_seen_at: lastSeenAt,
          visitor_online: visitorOnline,
          participant_type,
          business_name,
          business_id,
          business_logo,
          visitor_display_name: display_as_probot ? undefined : (visitor_display_name || undefined),
          profile_first_name: display_as_probot ? undefined : profile_first_name,
          profile_last_name: display_as_probot ? undefined : profile_last_name,
          profile_user_picture: display_as_probot ? undefined : profile_user_picture,
          display_as_probot,
          _lastActivityAt: lastActivityAt,
        };
      });

    // WhatsApp-style: one chat per contact. Group by business_id (contractor), user_id (signed-in customer), or visitor_id (anonymous).
    type WithMeta = (typeof withLastMessage)[number] & { _lastActivityAt: string };
    const byContactKey = new Map<string, WithMeta[]>();
    for (const item of withLastMessage as WithMeta[]) {
      const row = item as WithMeta & { user_id?: string | null };
      const bid = businessIdByConv.get(row.id);
      const key = bid ? `business-${bid}` : row.user_id ? `user-${row.user_id}` : `visitor-${row.visitor_id}`;
      if (!byContactKey.has(key)) byContactKey.set(key, []);
      byContactKey.get(key)!.push(item);
    }
    const onePerProfile: WithMeta[] = [];
    for (const items of byContactKey.values()) {
      // Sort by last activity descending; primary = first
      items.sort((a, b) => new Date(b._lastActivityAt).getTime() - new Date(a._lastActivityAt).getTime());
      const primary = items[0]!;
      const latestMessage = primary.lastMessage ?? null;
      const earliestFirst = items.reduce(
        (acc, i) => {
          const f = i.firstVisitorMessage;
          if (!f) return acc;
          if (!acc || new Date(f.created_at).getTime() < new Date(acc.created_at).getTime()) return f;
          return acc;
        },
        null as { body: string; created_at: string } | null
      );
      const totalUnread = items.reduce((sum, i) => sum + (i.unread_count ?? 0), 0);
      onePerProfile.push({
        ...primary,
        id: primary.id,
        lastMessage: latestMessage,
        firstVisitorMessage: earliestFirst ?? primary.firstVisitorMessage,
        unread_count: totalUnread,
        _lastActivityAt: primary._lastActivityAt,
      });
    }
    onePerProfile.sort((a, b) => new Date(b._lastActivityAt).getTime() - new Date(a._lastActivityAt).getTime());

    const conversations = onePerProfile.map(({ _lastActivityAt, ...rest }) => rest);

    return NextResponse.json({ conversations }, { status: 200 });
  } catch (e) {
    console.error('ProBot admin conversations GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

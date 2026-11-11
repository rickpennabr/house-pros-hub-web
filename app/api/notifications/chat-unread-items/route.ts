import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { getUnreadCountQuerySchema } from '@/lib/schemas/chat';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';

type MsgRow = {
  id: string;
  conversation_id: string;
  sender: 'visitor' | 'admin';
  body: string | null;
  created_at: string;
};

type ConvMeta = {
  id: string;
  visitor_display_name: string | null;
  user_id: string | null;
};

function previewBody(body: string | null, max = 80): string {
  if (!body?.trim()) return 'Attachment or empty message';
  const oneLine = body.trim().replace(/\s+/g, ' ');
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

function displayNameFromConv(
  conv: ConvMeta,
  profile: { first_name: string | null; last_name: string | null } | undefined
): string {
  const fromProfile = [profile?.first_name?.trim(), profile?.last_name?.trim()].filter(Boolean).join(' ');
  if (fromProfile) return fromProfile;
  const v = conv.visitor_display_name?.trim();
  if (v) return v;
  return 'Customer';
}

/**
 * GET /api/notifications/chat-unread-items
 * Lists each unread chat message as its own row (contractor: visitor + ProBot messages for their business;
 * customer: unread ProBot replies in their visitor thread). Used by the header notification bell.
 * Query: optional visitorId when the user is authenticated without a business (same rules as unread-count).
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

    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);

    if (!userError && user?.id) {
      if (user.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        return NextResponse.json({ items: [] }, { status: 200 });
      }

      const userBusinessId = await getOwnedBusinessId(user.id);

      if (userBusinessId) {
        const { data: visitorMsgs, error: vErr } = await supabase
          .from('probot_messages')
          .select('id, conversation_id, sender, body, created_at')
          .eq('sender', 'visitor')
          .eq('business_id', userBusinessId)
          .is('read_at', null)
          .order('created_at', { ascending: false })
          .limit(40);

        if (vErr) {
          console.error('chat-unread-items contractor visitor msgs:', vErr);
          return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
        }

        const { data: convRows } = await supabase
          .from('probot_messages')
          .select('conversation_id')
          .eq('business_id', userBusinessId);
        const conversationIds = [
          ...new Set((convRows ?? []).map((r: { conversation_id: string }) => r.conversation_id)),
        ];

        let adminMsgs: MsgRow[] = [];
        if (conversationIds.length > 0) {
          const { data: aData, error: aErr } = await supabase
            .from('probot_messages')
            .select('id, conversation_id, sender, body, created_at')
            .eq('sender', 'admin')
            .in('conversation_id', conversationIds)
            .is('read_at', null)
            .order('created_at', { ascending: false })
            .limit(40);
          if (aErr) {
            console.error('chat-unread-items contractor admin msgs:', aErr);
          } else {
            adminMsgs = (aData ?? []) as MsgRow[];
          }
        }

        const combined = [...((visitorMsgs ?? []) as MsgRow[]), ...adminMsgs].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const slice = combined.slice(0, 40);
        const convIdSet = [...new Set(slice.map((m) => m.conversation_id))];

        const { data: convList } = await supabase
          .from('probot_conversations')
          .select('id, visitor_display_name, user_id')
          .in('id', convIdSet);

        const convById = new Map<string, ConvMeta>();
        for (const c of (convList ?? []) as ConvMeta[]) {
          convById.set(c.id, c);
        }

        const userIds = [...new Set((convList ?? []).map((c: ConvMeta) => c.user_id).filter((id): id is string => typeof id === 'string' && id.length > 0))];
        const profileByUserId: Record<string, { first_name: string | null; last_name: string | null }> = {};
        if (userIds.length > 0) {
          const { data: profRows } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', userIds);
          for (const p of profRows ?? []) {
            const row = p as { id: string; first_name: string | null; last_name: string | null };
            profileByUserId[row.id] = row;
          }
        }

        const items = slice.map((m) => {
          const conv = convById.get(m.conversation_id);
          const prof = conv?.user_id ? profileByUserId[conv.user_id] : undefined;
          const title =
            m.sender === 'visitor'
              ? `Message from ${conv ? displayNameFromConv(conv, prof) : 'Customer'}`
              : 'House Pros Hub';
          return {
            id: m.id,
            conversationId: m.conversation_id,
            sender: m.sender,
            title,
            preview: previewBody(m.body),
            createdAt: m.created_at,
            probotHrefQuery: `conversation=${encodeURIComponent(m.conversation_id)}`,
          };
        });

        return NextResponse.json({ items }, { status: 200 });
      }
    }

    const visitorParsed = getUnreadCountQuerySchema.safeParse({
      visitorId: searchParams.get('visitorId') ?? '',
    });
    if (!visitorParsed.success) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    const { visitorId } = visitorParsed.data;
    const cookieDenied = visitorCookieDenied(request, visitorId);
    if (cookieDenied) return cookieDenied;

    const { data: conv } = await supabase
      .from('probot_conversations')
      .select('id')
      .eq('visitor_id', visitorId)
      .single();
    if (!conv) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    const conversationId = (conv as { id: string }).id;

    const { data: msgs, error: msgErr } = await supabase
      .from('probot_messages')
      .select('id, conversation_id, sender, body, created_at')
      .eq('conversation_id', conversationId)
      .eq('sender', 'admin')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(40);

    if (msgErr) {
      console.error('chat-unread-items visitor:', msgErr);
      return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
    }

    const items = ((msgs ?? []) as MsgRow[]).map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      sender: m.sender as 'admin',
      title: 'House Pros Hub',
      preview: previewBody(m.body),
      createdAt: m.created_at,
      probotHrefQuery: 'contact=probot',
    }));

    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    console.error('GET /api/notifications/chat-unread-items error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

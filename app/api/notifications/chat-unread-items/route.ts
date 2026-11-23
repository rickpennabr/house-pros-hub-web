import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { getUnreadCountQuerySchema } from '@/lib/schemas/chat';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';
import type { ChatLeadOffer } from '@/lib/types/chat';

type MsgRow = {
  id: string;
  conversation_id: string;
  sender: 'visitor' | 'admin';
  body: string | null;
  created_at: string;
};

type PersonalRow = MsgRow & { business_id: string | null; payload: unknown };

/** An open job request card in the message: the bell opens it in a modal instead of ProBot. */
function openLeadOffer(payload: unknown): ChatLeadOffer | null {
  const lead = (payload as { leadOffer?: ChatLeadOffer } | null)?.leadOffer;
  return lead?.referralId && lead.status === 'offered' ? lead : null;
}

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
 * Lists each unread chat message as its own row (contractor: customers' messages to their business plus ProBot /
 * pro replies in their own chats, matching the bell count;
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

        // Personal side, same rule as the bell count (loadUnreadByContact): unread ProBot / pro replies in
        // the user's own chats, e.g. a job request card. Replies from their own business are not personal mail.
        const { data: myConvs } = await supabase.from('probot_conversations').select('id').eq('user_id', user.id);
        const myConvIds = (myConvs ?? []).map((c: { id: string }) => c.id);
        let personalMsgs: PersonalRow[] = [];
        if (myConvIds.length > 0) {
          const { data: pData, error: pErr } = await supabase
            .from('probot_messages')
            .select('id, conversation_id, sender, body, created_at, business_id, payload')
            .eq('sender', 'admin')
            .in('conversation_id', myConvIds)
            .is('read_at', null)
            .order('created_at', { ascending: false })
            .limit(40);
          if (pErr) {
            console.error('chat-unread-items contractor personal msgs:', pErr);
          } else {
            personalMsgs = ((pData ?? []) as PersonalRow[]).filter((m) => m.business_id !== userBusinessId);
          }
        }
        const adminMsgs: MsgRow[] = personalMsgs;
        const personalById = new Map(personalMsgs.map((m) => [m.id, m]));
        const senderBusinessIds = [...new Set(personalMsgs.map((m) => m.business_id).filter((id): id is string => Boolean(id)))];
        const businessNameById = new Map<string, string>();
        if (senderBusinessIds.length > 0) {
          const { data: bizRows } = await supabase.from('businesses').select('id, business_name').in('id', senderBusinessIds);
          for (const b of bizRows ?? []) businessNameById.set(b.id, b.business_name);
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
              : (personalById.get(m.id)?.business_id ? businessNameById.get(personalById.get(m.id)?.business_id ?? '') : null) || 'House Pros Hub';
          const personal = personalById.get(m.id);
          const lead = personal ? openLeadOffer(personal.payload) : null;
          return {
            id: m.id,
            conversationId: m.conversation_id,
            sender: m.sender,
            title,
            preview: previewBody(m.body),
            createdAt: m.created_at,
            ...(lead ? { lead } : {}),
            probotHrefQuery: personal
              ? `contact=${encodeURIComponent(personal.business_id ?? 'probot')}&as=personal`
              : `conversation=${encodeURIComponent(m.conversation_id)}`,
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

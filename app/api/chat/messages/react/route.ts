import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';
import { visitorOwnsConversation } from '@/lib/chat/resolveConversation';
import { isMissingColumnError } from '@/lib/chat/probot-reply';
import { isChatReaction, parseReactions, type ReactionSide } from '@/lib/chat/reactions';

const schema = z.object({
  id: z.string().uuid(),
  /** null removes your reaction. */
  emoji: z.string().max(16).nullable(),
  /** Customers react with their visitorId; pros and Hub Agents with their session. */
  visitorId: z.string().max(100).optional(),
});

/**
 * POST /api/chat/messages/react { id, emoji | null, visitorId? }
 * Sets or clears the caller's reaction on a message. One reaction per side of the chat.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = await checkRateLimit(request, 'chatRead');
    if (limited) return limited;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { id, emoji, visitorId } = parsed.data;
    if (emoji !== null && !isChatReaction(emoji)) return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data: message } = await supabase
      .from('probot_messages')
      .select('id, conversation_id, business_id')
      .eq('id', id)
      .maybeSingle();
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    let side: ReactionSide | null = null;
    if (visitorId) {
      const cookieDenied = visitorCookieDenied(request, visitorId);
      if (cookieDenied) return cookieDenied;
      if (await visitorOwnsConversation(supabase, message.conversation_id, visitorId)) side = 'visitor';
    } else {
      const session = await createClient();
      const { data: { user } } = await session.auth.getUser();
      if (user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        side = 'admin';
      } else if (user) {
        const businessId = await getOwnedBusinessId(user.id);
        if (businessId) {
          // The pro may react in a thread they take part in.
          const { data: mine } = await supabase
            .from('probot_messages')
            .select('id')
            .eq('conversation_id', message.conversation_id)
            .eq('business_id', businessId)
            .limit(1)
            .maybeSingle();
          if (mine) side = 'admin';
        }
      }
    }
    if (!side) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const current = await supabase.from('probot_messages').select('reactions').eq('id', id).maybeSingle();
    if (isMissingColumnError(current.error)) {
      return NextResponse.json({ error: 'Reactions are not set up yet (apply migration 149).' }, { status: 503 });
    }
    const reactions = parseReactions((current.data as { reactions?: unknown } | null)?.reactions);
    if (emoji) reactions[side] = emoji;
    else delete reactions[side];

    const { error } = await supabase.from('probot_messages').update({ reactions }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reactions });
  } catch (err) {
    console.error('POST /api/chat/messages/react', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { getUnreadCountQuerySchema } from '@/lib/schemas/chat';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';
import { loadUnreadByContact } from '@/lib/chat/unread-by-contact';

/**
 * GET /api/notifications/unread-count
 * Returns total unread count for the app icon badge. Today = chat only; later can include CRM, calendar, etc.
 * Auth: signed-in users (admin included) → their own chats; contractor → business chat unread; else visitorId query → visitor chat unread.
 * Response: { count: number } (optional { chat: number } for future multi-source).
 */
export async function GET(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chatRead');
  if (rateLimitRes) return rateLimitRes;

  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    const supabase = createServiceRoleClient();

    // Authenticated: admin or contractor
    if (!userError && user?.id) {
      // Everyone, admin included, counts the chats they see on /probot. Visitor chats waiting for the admin
      // are counted on Admin > ProBot Chat (/api/chat/admin/unread-count), not on the floating ProBot.

      // Every signed-in user: all their chats (pros and ProBot replying), plus customers writing to their business.
      // Customers used to be counted on this browser's visitor chat only, which missed chats started elsewhere.
      const userBusinessId = await getOwnedBusinessId(user.id);
      const { business, personal } = await loadUnreadByContact(supabase, user.id, userBusinessId);
      const total = business + personal;
      return NextResponse.json({ count: total, chat: total, business, personal }, { status: 200 });
    }

    // Visitor: require visitorId query param
    const { searchParams } = new URL(request.url);
    const parsed = getUnreadCountQuerySchema.safeParse({
      visitorId: searchParams.get('visitorId') ?? '',
    });
    if (!parsed.success) {
      return NextResponse.json({ count: 0 }, { status: 200 });
    }
    const { visitorId } = parsed.data;
    const cookieDenied = visitorCookieDenied(request, visitorId);
    if (cookieDenied) return cookieDenied;
    const { data: conv } = await supabase
      .from('probot_conversations')
      .select('id')
      .eq('visitor_id', visitorId)
      .single();
    if (!conv) {
      return NextResponse.json({ count: 0, chat: 0 }, { status: 200 });
    }
    const { count, error } = await supabase
      .from('probot_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .eq('sender', 'admin')
      .is('read_at', null);
    if (error) {
      console.error('Notifications unread-count (visitor) error:', error);
      return NextResponse.json({ error: 'Failed to get unread count' }, { status: 500 });
    }
    const n = typeof count === 'number' ? count : 0;
    return NextResponse.json({ count: n, chat: n }, { status: 200 });
  } catch (e) {
    console.error('GET /api/notifications/unread-count error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

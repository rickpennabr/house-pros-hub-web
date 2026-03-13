import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { getUnreadCountQuerySchema } from '@/lib/schemas/chat';

/**
 * GET /api/notifications/unread-count
 * Returns total unread count for the app icon badge. Today = chat only; later can include CRM, calendar, etc.
 * Auth by role: admin → visitor messages unread; contractor → business chat unread; else visitorId query → visitor chat unread.
 * Response: { count: number } (optional { chat: number } for future multi-source).
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

    // Authenticated: admin or contractor
    if (!userError && user?.id) {
      if (user.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        const { count, error } = await supabase
          .from('probot_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender', 'visitor')
          .is('read_at', null);
        if (error) {
          console.error('Notifications unread-count (admin) error:', error);
          return NextResponse.json({ error: 'Failed to get unread count' }, { status: 500 });
        }
        const n = typeof count === 'number' ? count : 0;
        return NextResponse.json({ count: n, chat: n }, { status: 200 });
      }

      const { data: profile } = await supabaseAuth
        .from('profiles')
        .select('business_id')
        .eq('id', user.id)
        .single();
      const userBusinessId = (profile as { business_id?: string } | null)?.business_id ?? null;
      if (userBusinessId) {
        const { count: visitorCount, error: visitorError } = await supabase
          .from('probot_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender', 'visitor')
          .eq('business_id', userBusinessId)
          .is('read_at', null);
        if (visitorError) {
          console.error('Notifications unread-count (contractor visitor) error:', visitorError);
          return NextResponse.json({ error: 'Failed to get unread count' }, { status: 500 });
        }
        const { data: convRows } = await supabase
          .from('probot_messages')
          .select('conversation_id')
          .eq('business_id', userBusinessId);
        const conversationIds = [
          ...new Set((convRows ?? []).map((r: { conversation_id: string }) => r.conversation_id)),
        ];
        if (conversationIds.length === 0) {
          const n = typeof visitorCount === 'number' ? visitorCount : 0;
          return NextResponse.json({ count: n, chat: n }, { status: 200 });
        }
        const { count: adminCount, error: adminError } = await supabase
          .from('probot_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender', 'admin')
          .in('conversation_id', conversationIds)
          .is('read_at', null);
        if (adminError) {
          const n = typeof visitorCount === 'number' ? visitorCount : 0;
          return NextResponse.json({ count: n, chat: n }, { status: 200 });
        }
        const total =
          (typeof visitorCount === 'number' ? visitorCount : 0) +
          (typeof adminCount === 'number' ? adminCount : 0);
        return NextResponse.json({ count: total, chat: total }, { status: 200 });
      }
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

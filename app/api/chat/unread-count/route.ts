import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { getUnreadCountQuerySchema } from '@/lib/schemas/chat';

/**
 * GET /api/chat/unread-count?visitorId=xxx
 * Returns count of admin messages not yet read (read_at is null) in the visitor's conversation.
 * Used for the notification bell badge when the user (customer) has unread ProBot messages.
 */
export async function GET(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = getUnreadCountQuerySchema.safeParse({ visitorId: searchParams.get('visitorId') ?? '' });
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors?.visitorId?.[0] ?? 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { visitorId } = parsed.data;

    const supabase = createServiceRoleClient();
    const { data: conv } = await supabase
      .from('probot_conversations')
      .select('id')
      .eq('visitor_id', visitorId)
      .single();

    if (!conv) {
      return NextResponse.json({ count: 0 }, { status: 200 });
    }

    const { count, error } = await supabase
      .from('probot_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .eq('sender', 'admin')
      .is('read_at', null);

    if (error) {
      console.error('ProBot unread-count error:', error);
      return NextResponse.json({ error: 'Failed to get unread count' }, { status: 500 });
    }

    return NextResponse.json({ count: typeof count === 'number' ? count : 0 }, { status: 200 });
  } catch (e) {
    console.error('GET /api/chat/unread-count error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * GET /api/chat/contractor/unread-count
 * Returns count of unread messages for this contractor's business:
 * - Visitor (customer) messages to their business not yet read
 * - Admin (ProBot/Hub) messages in those same conversations not yet read.
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
      return NextResponse.json({ count: 0 }, { status: 200 });
    }

    const supabase = createServiceRoleClient();

    // 1) Unread visitor (customer) messages to this business
    const { count: visitorCount, error: visitorError } = await supabase
      .from('probot_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'visitor')
      .eq('business_id', userBusinessId)
      .is('read_at', null);

    if (visitorError) {
      console.error('ProBot contractor unread-count (visitor) error:', visitorError);
      return NextResponse.json({ error: 'Failed to get unread count' }, { status: 500 });
    }

    // 2) Conversation IDs that have at least one message to this business
    const { data: convRows } = await supabase
      .from('probot_messages')
      .select('conversation_id')
      .eq('business_id', userBusinessId);
    const conversationIds = [...new Set((convRows ?? []).map((r: { conversation_id: string }) => r.conversation_id))];
    if (conversationIds.length === 0) {
      return NextResponse.json({ count: typeof visitorCount === 'number' ? visitorCount : 0 }, { status: 200 });
    }

    // 3) Unread admin (ProBot) messages in those conversations
    const { count: adminCount, error: adminError } = await supabase
      .from('probot_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'admin')
      .in('conversation_id', conversationIds)
      .is('read_at', null);

    if (adminError) {
      console.error('ProBot contractor unread-count (admin) error:', adminError);
      return NextResponse.json({ count: typeof visitorCount === 'number' ? visitorCount : 0 }, { status: 200 });
    }

    const total = (typeof visitorCount === 'number' ? visitorCount : 0) + (typeof adminCount === 'number' ? adminCount : 0);
    return NextResponse.json({ count: total }, { status: 200 });
  } catch (e) {
    console.error('GET /api/chat/contractor/unread-count error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

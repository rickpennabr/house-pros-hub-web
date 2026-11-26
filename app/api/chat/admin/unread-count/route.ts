import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * GET /api/chat/admin/unread-count
 * Returns total count of visitor messages not yet read by admin (read_at is null).
 * Used for the ProBot floating button badge when the admin has unread messages.
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

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin = user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    // Admins' own chats with ProBot don't count: their own messages are never "new" to them.
    const { data: adminUsers } = await supabase.from('admin_users').select('user_id');
    const adminIds = (adminUsers ?? []).map((row) => (row as { user_id: string }).user_id).filter(Boolean);
    let ownConversationIds: string[] = [];
    if (adminIds.length > 0) {
      const { data: ownConvs } = await supabase.from('probot_conversations').select('id').in('user_id', adminIds);
      ownConversationIds = (ownConvs ?? []).map((row) => (row as { id: string }).id);
    }
    let query = supabase
      .from('probot_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'visitor')
      .is('read_at', null);
    if (ownConversationIds.length > 0) query = query.not('conversation_id', 'in', `(${ownConversationIds.join(',')})`);
    const { count, error } = await query;

    if (error) {
      console.error('ProBot admin unread-count error:', error);
      return NextResponse.json({ error: 'Failed to get unread count' }, { status: 500 });
    }

    return NextResponse.json({ count: typeof count === 'number' ? count : 0 }, { status: 200 });
  } catch (e) {
    console.error('GET /api/chat/admin/unread-count error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

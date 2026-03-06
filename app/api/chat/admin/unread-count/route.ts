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
    const isAdmin = user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    const { count, error } = await supabase
      .from('probot_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'visitor')
      .is('read_at', null);

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

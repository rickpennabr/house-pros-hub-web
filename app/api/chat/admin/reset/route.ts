import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * POST /api/chat/admin/reset
 * Admin only. Truncates probot_messages and probot_conversations so the chat system is clean for all users.
 * Use for staging or to "clean all chat for all users". Does not remove admin_users or push subscriptions.
 */
export async function POST(request: NextRequest) {
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

    await supabase.from('probot_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const delConv = await supabase.from('probot_conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (delConv.error) {
      console.error('ProBot admin reset conversations error:', delConv.error);
      return NextResponse.json({ error: 'Failed to reset conversations' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'Chat data reset for all users.' }, { status: 200 });
  } catch (e) {
    console.error('POST /api/chat/admin/reset error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

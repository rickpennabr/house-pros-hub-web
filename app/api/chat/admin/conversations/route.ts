import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { NextRequest } from 'next/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * GET /api/chat/admin/conversations
 * List all ProBot conversations for admin. Ensures admin is in admin_users for Realtime.
 */
export async function GET(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const supabaseAuth = await createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabaseAuth.auth.getSession();

    if (sessionError || !session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin =
      session.user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    // Ensure admin can use Realtime: upsert into admin_users
    await supabase.from('admin_users').upsert(
      { user_id: session.user.id },
      { onConflict: 'user_id' }
    );

    const { data: conversations, error } = await supabase
      .from('probot_conversations')
      .select('id, visitor_id, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('ProBot admin conversations GET error:', error);
      return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 });
    }

    // Optionally attach last message per conversation
    const withLastMessage = await Promise.all(
      (conversations ?? []).map(async (c) => {
        const { data: last } = await supabase
          .from('probot_messages')
          .select('body, created_at, sender')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        return { ...c, lastMessage: last ?? null };
      })
    );

    return NextResponse.json({ conversations: withLastMessage }, { status: 200 });
  } catch (e) {
    console.error('ProBot admin conversations GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

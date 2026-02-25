import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/** Hours to consider "new" signups for the notification badge. */
const NEW_SIGNUPS_HOURS = 24;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      ),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * GET /api/admin/notifications/new-signups-count
 * Returns count of new customer and contractor signups since the admin last marked as read (or last 24h if never). Admin only.
 * Used to show the notification badge on the admin header bell.
 */
export async function GET() {
  try {
    const { error: authError, user } = await requireAdmin();
    if (authError) return authError;

    const service = createServiceRoleClient();
    const windowStart = Date.now() - NEW_SIGNUPS_HOURS * 60 * 60 * 1000;

    let since = new Date(windowStart).toISOString();
    if (user) {
      const { data: row } = await service
        .from('admin_notification_read')
        .select('read_at')
        .eq('user_id', user.id)
        .single();
      if (row?.read_at) {
        const readAt = new Date(row.read_at).getTime();
        since = new Date(Math.max(windowStart, readAt)).toISOString();
      }
    }

    const { count, error: countError } = await service
      .from('admin_notification_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);

    if (countError) {
      console.error('new-signups-count admin_notification_events', countError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (error) {
    console.error('GET /api/admin/notifications/new-signups-count', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

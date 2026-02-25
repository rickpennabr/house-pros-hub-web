import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

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
 * POST /api/admin/notifications/mark-read
 * Marks "new signups" notifications as read for the current admin.
 * Badge count will only include signups after this time (within 24h window).
 */
export async function POST() {
  try {
    const { error: authError, user } = await requireAdmin();
    if (authError) return authError;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = createServiceRoleClient();
    const { error: upsertError } = await service
      .from('admin_notification_read')
      .upsert(
        { user_id: user.id, read_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('POST /api/admin/notifications/mark-read upsert', upsertError);
      return NextResponse.json(
        { error: 'Failed to mark notifications as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/admin/notifications/mark-read', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

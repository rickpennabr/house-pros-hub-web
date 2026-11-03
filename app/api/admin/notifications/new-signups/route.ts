import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import {
  adminNotificationHref,
  type AdminNotificationEntityType,
  type AdminNotificationEventType,
} from '@/lib/types/adminNotification';

/** Hours to consider "new" signups; must match new-signups-count. */
const NEW_SIGNUPS_HOURS = 24;
const MAX_ITEMS = 30;

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

export type NewSignupItem = {
  id: string;
  type: AdminNotificationEntityType;
  name: string;
  createdAt: string;
  href: string;
  eventType: AdminNotificationEventType;
  detail?: string | null;
};

/**
 * GET /api/admin/notifications/new-signups
 * Returns platform events from the last 24 hours (signups, estimates, bookings, mail). Admin only.
 * Events persist even after the user or business is deleted.
 */
export async function GET() {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const since = new Date(Date.now() - NEW_SIGNUPS_HOURS * 60 * 60 * 1000).toISOString();
    const service = createServiceRoleClient();

    let { data: events, error: eventsError } = await service
      .from('admin_notification_events')
      .select('id, event_type, entity_type, entity_id, display_name, detail, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS);

    if (eventsError && (eventsError.code === '42703' || /detail/i.test(eventsError.message))) {
      const fallback = await service
        .from('admin_notification_events')
        .select('id, event_type, entity_type, entity_id, display_name, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(MAX_ITEMS);
      events = (fallback.data ?? []).map((row) => ({ ...row, detail: null }));
      eventsError = fallback.error;
    }

    if (eventsError) {
      console.error('GET /api/admin/notifications/new-signups', eventsError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const items: NewSignupItem[] = (events ?? []).map((e) => ({
      id: e.id,
      type: e.entity_type as AdminNotificationEntityType,
      name: e.display_name,
      createdAt: e.created_at,
      href: adminNotificationHref(e.entity_type, e.event_type),
      eventType: e.event_type as AdminNotificationEventType,
      detail: 'detail' in e ? e.detail : null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('GET /api/admin/notifications/new-signups', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

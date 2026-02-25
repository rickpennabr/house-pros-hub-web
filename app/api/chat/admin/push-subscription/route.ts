import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { pushSubscriptionSchema } from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * POST /api/chat/admin/push-subscription
 * Store Web Push subscription for the current admin (for new message notifications).
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabaseAuth.auth.getSession();

    if (sessionError || !session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin =
      session.user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = pushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }
    const { endpoint, keys } = parsed.data;

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('admin_push_subscriptions').upsert(
      {
        user_id: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('ProBot push subscription save error:', error);
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('ProBot push-subscription POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

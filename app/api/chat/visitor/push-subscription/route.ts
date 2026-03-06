import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { visitorPushSubscriptionSchema } from '@/lib/schemas/chat';

/**
 * POST /api/chat/visitor/push-subscription
 * Store Web Push subscription for a visitor in a conversation.
 * When a contractor or admin replies, the visitor receives a push notification.
 * No auth required; verified by conversationId + visitorId ownership.
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'pushSubscription');
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    const parsed = visitorPushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors?.visitorId?.[0]
        ?? parsed.error.flatten().fieldErrors?.conversationId?.[0]
        ?? 'Invalid subscription';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { conversationId, visitorId, endpoint, keys } = parsed.data;

    const supabase = createServiceRoleClient();
    const { data: conv } = await supabase
      .from('probot_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('visitor_id', visitorId)
      .single();
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { error } = await supabase.from('visitor_push_subscriptions').upsert(
      {
        conversation_id: conversationId,
        visitor_id: visitorId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('Visitor push subscription save error:', error);
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('Visitor push-subscription POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

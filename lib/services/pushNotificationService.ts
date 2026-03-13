import webpush from 'web-push';
import { createServiceRoleClient } from '@/lib/supabase/server';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

let vapidInitialized = false;

function ensureVapid(): boolean {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  if (vapidInitialized) return true;
  try {
    webpush.setVapidDetails('mailto:admin@houseproshub.com', VAPID_PUBLIC, VAPID_PRIVATE);
    vapidInitialized = true;
    return true;
  } catch {
    return false;
  }
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  badge?: number;
}

function buildPayload(title: string, body: string, url: string, badge?: number): string {
  const payload: PushPayload = { title, body, url };
  if (typeof badge === 'number' && badge >= 0) payload.badge = Math.min(99, badge);
  return JSON.stringify(payload);
}

/**
 * Send Web Push to all stored admin subscriptions (e.g. on new visitor message).
 * No-op if VAPID keys or subscriptions are missing.
 */
export async function sendAdminPushNotification(
  title: string,
  body: string,
  url: string = '/admin/chat',
  badge?: number
): Promise<void> {
  if (!ensureVapid()) return;

  const supabase = createServiceRoleClient();
  const { data: subs, error } = await supabase
    .from('admin_push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (error || !subs?.length) return;

  const payload = buildPayload(title, body, url, badge);

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 60 }
      )
    )
  );
}

/**
 * Send Web Push to the owner(s) of a business when a visitor messages that business.
 * Looks up business owner_id from public.businesses, then sends to all their
 * business_push_subscriptions. No-op if VAPID keys, business, or subscriptions are missing.
 */
export async function sendBusinessPushNotification(
  businessId: string,
  title: string,
  body: string,
  url: string = '/probot',
  badge?: number
): Promise<void> {
  if (!ensureVapid()) return;

  const supabase = createServiceRoleClient();
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', businessId)
    .single();

  if (bizError || !business?.owner_id) return;

  const { data: subs, error } = await supabase
    .from('business_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', business.owner_id);

  if (error || !subs?.length) return;

  const payload = buildPayload(title, body, url, badge);

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 60 }
      )
    )
  );
}

/**
 * Send Web Push to all visitor subscriptions for a conversation when contractor or admin replies.
 * No-op if VAPID keys or subscriptions are missing.
 */
export async function sendVisitorPushNotification(
  conversationId: string,
  title: string,
  body: string,
  url: string = '/',
  badge?: number
): Promise<void> {
  if (!ensureVapid()) return;

  const supabase = createServiceRoleClient();
  const { data: subs, error } = await supabase
    .from('visitor_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('conversation_id', conversationId);

  if (error || !subs?.length) return;

  const payload = buildPayload(title, body, url, badge);

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 60 }
      )
    )
  );
}

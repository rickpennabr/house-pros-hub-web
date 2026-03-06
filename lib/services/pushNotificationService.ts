import webpush from 'web-push';
import { createServiceRoleClient } from '@/lib/supabase/server';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send Web Push to all stored admin subscriptions (e.g. on new visitor message).
 * No-op if VAPID keys or subscriptions are missing.
 */
export async function sendAdminPushNotification(
  title: string,
  body: string,
  url: string = '/admin/chat'
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  try {
    webpush.setVapidDetails(
      'mailto:admin@houseproshub.com',
      VAPID_PUBLIC,
      VAPID_PRIVATE
    );
  } catch {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: subs, error } = await supabase
    .from('admin_push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (error || !subs?.length) return;

  const payload = JSON.stringify({ title, body, url });

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
  url: string = '/probot'
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  try {
    webpush.setVapidDetails(
      'mailto:admin@houseproshub.com',
      VAPID_PUBLIC,
      VAPID_PRIVATE
    );
  } catch {
    return;
  }

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

  const payload = JSON.stringify({ title, body, url });

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
  url: string = '/'
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  try {
    webpush.setVapidDetails(
      'mailto:admin@houseproshub.com',
      VAPID_PUBLIC,
      VAPID_PRIVATE
    );
  } catch {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: subs, error } = await supabase
    .from('visitor_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('conversation_id', conversationId);

  if (error || !subs?.length) return;

  const payload = JSON.stringify({ title, body, url });

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

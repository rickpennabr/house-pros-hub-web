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

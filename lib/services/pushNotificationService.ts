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
  tag?: string;
  icon?: string;
}

/** A day. Sixty seconds dropped the banner when the phone was locked. */
const PUSH_TTL_SECONDS = 60 * 60 * 24;

const APP_LOCALES = ['en', 'es', 'pt'] as const;
type AppLocale = (typeof APP_LOCALES)[number];

type SubscriptionTable =
  | 'admin_push_subscriptions'
  | 'business_push_subscriptions'
  | 'visitor_push_subscriptions';

/** Chat lives under the locale. /probot and / are not real pages. */
export function chatPushUrl(locale: string | undefined): string {
  const safe: AppLocale = APP_LOCALES.includes(locale as AppLocale) ? (locale as AppLocale) : 'en';
  return `/${safe}/probot`;
}

/** Locale of the page that sent the reply, so the opened chat matches that site. */
export function pushLocaleFromRequest(request: { headers: { get(name: string): string | null } }): AppLocale {
  const referer = request.headers.get('referer');
  if (!referer) return 'en';
  try {
    const segment = new URL(referer).pathname.split('/')[1] ?? '';
    if (APP_LOCALES.includes(segment as AppLocale)) return segment as AppLocale;
  } catch {
    /* A bad Referer still opens the English chat. */
  }
  return 'en';
}

function pushStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return null;
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' ? status : null;
}

function buildPayload(title: string, body: string, url: string, badge?: number, tag?: string, icon?: string): string {
  const payload: PushPayload = { title, body, url };
  if (typeof badge === 'number' && badge >= 0) payload.badge = Math.min(99, badge);
  if (tag) payload.tag = tag;
  if (icon) payload.icon = icon;
  return JSON.stringify(payload);
}

async function deliver(table: SubscriptionTable, subs: PushSubscriptionRow[], payload: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: PUSH_TTL_SECONDS }
        );
      } catch (error) {
        const status = pushStatus(error);
        // 404 and 410 mean the browser dropped the subscription.
        if (status === 404 || status === 410) {
          await supabase.from(table).delete().eq('endpoint', sub.endpoint);
        }
      }
    })
  );
}

/**
 * Send Web Push to all stored admin subscriptions (e.g. on new visitor message).
 * No-op if VAPID keys or subscriptions are missing.
 */
export async function sendAdminPushNotification(
  title: string,
  body: string,
  url: string = '/admin/chat',
  badge?: number,
  tag?: string,
  icon?: string
): Promise<void> {
  if (!ensureVapid()) return;

  const supabase = createServiceRoleClient();
  const { data: subs, error } = await supabase
    .from('admin_push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (error || !subs?.length) return;

  await deliver('admin_push_subscriptions', subs, buildPayload(title, body, url, badge, tag, icon));
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
  url: string = '/en/probot',
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

  await deliver('business_push_subscriptions', subs, buildPayload(title, body, url, badge));
}

/**
 * Send Web Push to all visitor subscriptions for a conversation when contractor or admin replies.
 * No-op if VAPID keys or subscriptions are missing.
 */
export async function sendVisitorPushNotification(
  conversationId: string,
  title: string,
  body: string,
  url: string = '/en/probot',
  badge?: number
): Promise<void> {
  if (!ensureVapid()) return;

  const supabase = createServiceRoleClient();
  const { data: subs, error } = await supabase
    .from('visitor_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('conversation_id', conversationId);

  if (error || !subs?.length) return;

  await deliver('visitor_push_subscriptions', subs, buildPayload(title, body, url, badge));
}

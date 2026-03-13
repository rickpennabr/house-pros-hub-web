/**
 * Notification and app icon badge behavior.
 *
 * --- Push trigger map ---
 * - Visitor sends message (POST /api/chat/messages)
 *   → sendAdminPushNotification (all admin subscriptions)
 *   → sendBusinessPushNotification(businessId) when message targets a business
 *
 * - Admin or contractor replies (POST /api/chat/admin/messages)
 *   → sendVisitorPushNotification(conversationId) (visitor subscriptions for that conversation)
 *
 * Payload shape: { title, body, url, badge?: number }. Badge is optional; service worker uses payload.badge or 1.
 *
 * --- Badge behavior ---
 * - Badge = total unread count (today: chat only; later: chat + CRM, calendar, etc.).
 * - Set on push: service worker sets app icon badge from payload.badge (or 1 if omitted).
 * - Cleared on notification click: service worker calls clearAppBadge() when user opens app from notification.
 * - Corrected by client: when app loads, client fetches GET /api/notifications/unread-count and sets/clears badge.
 *
 * --- Unread count ---
 * - GET /api/notifications/unread-count: single source for app icon badge.
 *   Auth by role: admin → visitor messages unread; contractor → business chat unread; else visitorId query → visitor chat unread.
 *   Response: { count: number, chat?: number }.
 *
 * --- Why home screen app icon badge may not show ---
 * - The red number on the HouseProsHub app icon only appears when the app is installed as a PWA (Add to Home Screen).
 * - If you open the site in Safari/Chrome without adding to home screen, there is no app icon to badge.
 * - Fix: Add House Pros Hub to your home screen (Safari: Share → Add to Home Screen; Chrome: Menu → Install app / Add to Home Screen).
 * - After installing, when the app is open we set the badge from unread count; when the app is closed, the badge is updated when a push is received (so enable "Get notifications when we reply" in chat).
 *
 * --- Why pop-up (banner) notifications may not show ---
 * - Pop-ups at the top of the phone require: (1) Notification permission granted, (2) Push enabled in the app (e.g. "Enable" in ProBot chat), (3) Backend sending web push when someone replies.
 * - On iOS, for best results install the app (Add to Home Screen) and then enable notifications in chat; banners are shown by the OS when a push arrives.
 */

export const NOTIFICATION_BADGE_MAX = 99;

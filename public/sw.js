/* ProBot Web Push service worker */
self.addEventListener('push', function (event) {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'ProBot', body: 'New message', url: '/admin/chat' };
  }
  const title = payload.title || 'ProBot';
  const body = payload.body || 'New message';
  const url = payload.url || '/admin/chat';
  const options = {
    body,
    icon: '/pro-bot-solo.png',
    badge: '/pro-bot-solo.png',
    data: { url },
    tag: 'probot-chat',
    renotify: true,
    silent: false,
    requireInteraction: true, // Keep notification visible until user taps (helps on mobile)
  };
  const badgeCount =
    typeof payload.badge === 'number' && payload.badge >= 0
      ? Math.min(99, Math.floor(payload.badge))
      : 1;
  // Notify visible clients so the app can show an in-app banner (and play sound) when admin has site open.
  const notifyClients = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(function (clientList) {
      const message = { type: 'PROBOT_PUSH', payload: { title, body, url, badge: badgeCount } };
      clientList.forEach(function (client) {
        if (client.visibilityState === 'visible' && client.url && client.url.indexOf(self.location.origin) === 0) {
          client.postMessage(message);
        }
      });
    });
  const showNotif = self.registration.showNotification(title, options);
  const setBadge =
    typeof self.navigator !== 'undefined' && 'setAppBadge' in self.navigator
      ? self.navigator.setAppBadge(badgeCount).catch(function () {})
      : Promise.resolve();
  event.waitUntil(Promise.all([notifyClients, showNotif, setBadge]));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/admin/chat';
  const clearBadge =
    typeof self.navigator !== 'undefined' && 'clearAppBadge' in self.navigator
      ? self.navigator.clearAppBadge().catch(function () {})
      : Promise.resolve();
  event.waitUntil(
    Promise.all([
      clearBadge,
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(self.location.origin + url);
        }
      }),
    ])
  );
});

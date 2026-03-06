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
  };
  const showNotif = self.registration.showNotification(title, options);
  // Update app icon badge when push received in background (e.g. iPhone home screen).
  const setBadge =
    typeof self.navigator !== 'undefined' && 'setAppBadge' in self.navigator
      ? self.navigator.setAppBadge(1).catch(function () {})
      : Promise.resolve();
  event.waitUntil(Promise.all([showNotif, setBadge]));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/admin/chat';
  event.waitUntil(
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
    })
  );
});

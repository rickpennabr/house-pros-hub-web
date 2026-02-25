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
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
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

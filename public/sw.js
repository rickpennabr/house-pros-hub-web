/* ProBot Web Push service worker */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async function () {
      // Any app served from this origin shares one /sw.js registration, so navigation
      // preload can still be on from a worker that used it. This one answers the share
      // target only, so a preloaded navigation would be fetched twice: once by the
      // preload, once by the fall-through to the network. That double hit burns
      // single-use URLs such as the OAuth callback code.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable();
      }
      await self.clients.claim();
    })()
  );
});

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
    icon: payload.icon || '/pro-bot-solo.png',
    badge: '/pro-bot-solo.png',
    data: { url },
    tag: payload.tag || 'probot-chat',
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

function notificationTarget(url) {
  var path = typeof url === 'string' && url ? url : '/en/probot';
  if (path.indexOf('http://') === 0 || path.indexOf('https://') === 0) {
    try {
      var parsed = new URL(path);
      if (parsed.origin !== self.location.origin) return self.location.origin + '/en/probot';
      path = parsed.pathname + parsed.search;
    } catch (e) {
      path = '/en/probot';
    }
  }
  if (path.charAt(0) !== '/') path = '/' + path;
  // Older payloads used paths that are not pages.
  if (path === '/probot' || path.indexOf('/probot?') === 0) path = '/en' + path;
  if (path === '/') path = '/en/probot';
  return new URL(path, self.location.origin).href;
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = notificationTarget(event.notification.data && event.notification.data.url);
  var clearBadge =
    typeof self.navigator !== 'undefined' && 'clearAppBadge' in self.navigator
      ? self.navigator.clearAppBadge().catch(function () {})
      : Promise.resolve();
  event.waitUntil(
    Promise.all([
      clearBadge,
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
        var same = null;
        var any = null;
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (!client.url || client.url.indexOf(self.location.origin) !== 0) continue;
          if (!any) any = client;
          if (client.url.split('#')[0] === target) same = client;
        }
        var chosen = same || any;
        if (chosen && 'focus' in chosen) {
          if (chosen.url.split('#')[0] !== target && typeof chosen.navigate === 'function') {
            return chosen.navigate(target).then(function (next) {
              return (next || chosen).focus();
            }).catch(function () {
              return clients.openWindow ? clients.openWindow(target) : chosen.focus();
            });
          }
          return chosen.focus();
        }
        if (clients.openWindow) return clients.openWindow(target);
      }),
    ])
  );
});

/* Quick Repair share target. Same IndexedDB as lib/media/quick-repair-draft.ts. */
var SHARE_DB = 'hph-quick-repair';
var SHARE_STORE = 'draft';
var SHARE_KEY = 'current';
var SHARE_MAX = 5;

function openShareDb() {
  return new Promise(function (resolve, reject) {
    var request = indexedDB.open(SHARE_DB, 1);
    request.onupgradeneeded = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) db.createObjectStore(SHARE_STORE);
    };
    request.onsuccess = function () { resolve(request.result); };
    request.onerror = function () { reject(request.error || new Error('draft db')); };
  });
}

function emptyDraft() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    trade: '',
    description: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    latitude: null,
    longitude: null,
    accuracyM: null,
    photos: [],
  };
}

function readDraft(db) {
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(SHARE_STORE, 'readonly');
    var request = tx.objectStore(SHARE_STORE).get(SHARE_KEY);
    request.onsuccess = function () { resolve(request.result || null); };
    request.onerror = function () { reject(request.error); };
  });
}

function writeDraft(db, draft) {
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(SHARE_STORE, 'readwrite');
    tx.objectStore(SHARE_STORE).put(draft, SHARE_KEY);
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error); };
  });
}

function localeFromShare(request) {
  var cookie = request.headers.get('cookie') || '';
  var match = cookie.match(/(?:^|;\s*)NEXT_LOCALE=(en|es|pt)(?:;|$)/);
  if (match) return match[1];
  var lang = (self.navigator.language || 'en').toLowerCase();
  if (lang.indexOf('es') === 0) return 'es';
  if (lang.indexOf('pt') === 0) return 'pt';
  return 'en';
}

async function appendSharedPhotos(files) {
  var db = await openShareDb();
  var existing = await readDraft(db);
  var draft = existing && Array.isArray(existing.photos) ? existing : emptyDraft();
  if (!Array.isArray(draft.photos)) draft.photos = [];
  files.forEach(function (file) {
    if (draft.photos.length >= SHARE_MAX) return;
    draft.photos.push({
      name: file.name || ('shared-' + Date.now() + '.jpg'),
      type: file.type || 'image/jpeg',
      blob: file,
      driveId: null,
    });
  });
  await writeDraft(db, draft);
  db.close();
}

async function handleShare(request) {
  var locale = localeFromShare(request);
  var destination = new URL('/' + locale + '/quick-repair?shared=1', self.location.origin);
  try {
    var form = await request.formData();
    var incoming = form.getAll('photos').filter(function (item) {
      return item && typeof item === 'object' && typeof item.type === 'string' && item.type.indexOf('image/') === 0;
    });
    if (incoming.length) await appendSharedPhotos(incoming);
  } catch (error) {
    /* Open Quick Repair even when the shared files cannot be read. */
  }
  return Response.redirect(destination.href, 303);
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'POST') return;
  var path = new URL(event.request.url).pathname;
  if (!/^\/(en|es|pt)\/share-target\/?$/.test(path) && path !== '/share-target') return;
  event.respondWith(handleShare(event.request));
});

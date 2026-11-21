// The service worker, for the daily reminder (lib/push.ts) and a 1-on-1 match found while away (lib/push-send.ts): it
// shows the push, kept on screen till answered when it's sticky, and opens its page when it's tapped. No caching: the pages are the CDN's.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Up and down', {
    body: d.body || '', icon: '/apple-icon', badge: '/apple-icon', tag: d.tag || 'daily', lang: d.lang || 'en', requireInteraction: !!d.sticky, renotify: !!d.sticky,
    data: { url: d.url || '/race' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/race', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.navigate(url).then((w) => (w || c).focus());
    return self.clients.openWindow(url);
  }));
});

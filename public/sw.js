// The service worker, for the daily reminder only (lib/push.ts): it shows the push app/push/remind sends, and opens
// today's race when it's tapped. No caching: the pages are the CDN's.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Up and down', {
    body: d.body || '', icon: '/apple-icon', badge: '/apple-icon', tag: d.tag || 'daily', lang: d.lang || 'en',
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

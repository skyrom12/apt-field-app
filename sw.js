// APT Field App service worker - cache the shell, never cache API calls.
//
// 2026-10-07: this was network-first with a cache fallback and no timeout, so a
// technician on one bar in a customer's driveway got a hanging fetch and a blank
// screen instead of the app. Reported by Bradley: "couldn't get the app to load".
// Cache-first now, with a background refresh, so the app opens instantly even with
// no signal and picks up a new version on the next open.
const CACHE = 'apt-shell-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // API and external: straight to network
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(hit => {
      // Refresh in the background whether or not we had a hit. waitUntil keeps the
      // worker alive long enough to finish writing the new copy.
      const fresh = fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy)));
        }
        return res;
      }).catch(() => hit);

      if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh;
    })
  );
});

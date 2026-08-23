// bayoutonefm service worker
// Caches the app shell (the single index.html) network-first so the page loads
// even when offline or after a network hiccup. Supabase + external music APIs
// are cross-origin, so they always go straight to the network (no caching).
const CACHE = 'bayoutonefm-shell-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only manage same-origin requests (the app shell). Everything else hits the network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        const type = res.headers.get('content-type') || '';
        // Cache the HTML shell so it is available offline next time.
        if (res && res.status === 200 && (req.mode === 'navigate' || type.includes('text/html'))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});

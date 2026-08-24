// bayoutonefm service worker
// - App shell (index.html): network-first so content is always fresh, cached for offline.
// - Same-origin static assets (logo.js, icons, manifest): stale-while-revalidate
//   for instant repeat loads.
// - Google Fonts: cache-first (font files are immutable).
// - Supabase + external music APIs: cross-origin, always straight to the network.
const CACHE = 'bayoutonefm-shell-v2';
const FONT_CACHE = 'bayoutonefm-fonts-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(req, cacheName) {
  return caches.match(req).then(hit => {
    if (hit) return hit;
    return fetch(req).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(cacheName).then(c => c.put(req, copy));
      }
      return res;
    });
  });
}

function staleWhileRevalidate(req) {
  return caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit);
    return hit || net;
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Google Fonts: immutable assets, cache-first.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, FONT_CACHE));
    return;
  }

  // Everything else cross-origin (Supabase, music APIs): network.
  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get('accept') || '';
  const isHtml = req.mode === 'navigate' || accept.includes('text/html');

  // App shell: network-first, fall back to cache when offline.
  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Static assets: serve from cache instantly, refresh in background.
  event.respondWith(staleWhileRevalidate(req));
});

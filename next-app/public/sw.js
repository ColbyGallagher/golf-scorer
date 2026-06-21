const CACHE = 'golf-scorer-v2';

// Derive basePath from the SW's own URL (e.g. /golf-scorer/sw.js → /golf-scorer)
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');

const APP_SHELL = [
  `${BASE}/`,
  `${BASE}/setup`,
  `${BASE}/game`,
  `${BASE}/card`,
  `${BASE}/teams`,
  `${BASE}/comps`,
  `${BASE}/history`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/icon.svg`,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        APP_SHELL.map(url =>
          fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Pass through external requests (Supabase, fonts, etc.) and non-GET
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  // Cache-first (immutable) for hashed Next.js static assets
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached ?? fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // Stale-while-revalidate for app routes and other assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => null);

      return cached ?? networkFetch ?? caches.match(`${BASE}/`);
    })
  );
});

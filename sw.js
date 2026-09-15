/**
 * Offline shell. Bump CACHE when you change any file below, otherwise an
 * installed copy on your phone will keep serving the old one.
 */
const CACHE = 'workouts-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/main.js',
  './js/store.js',
  './js/types.js',
  './js/theme.js',
  './js/util/date.js',
  './js/util/dom.js',
  './js/util/units.js',
  './js/ui/icons.js',
  './js/ui/sheet.js',
  './js/ui/calendar.js',
  './js/ui/day.js',
  './js/ui/editor.js',
  './js/ui/stats.js',
  './js/ui/settings.js',
  './js/ui/importSheet.js',
  './js/integrations/csv.js',
  './js/integrations/importer.js',
  './js/integrations/strava.js',
  './js/integrations/gist.js',
  './assets/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll is all-or-nothing; cache what we can so one 404 doesn't kill it.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache Strava or GitHub API traffic — it's authenticated and changes.
  if (url.origin !== location.origin) return;

  // Navigations: try the network so a deploy lands quickly, fall back to cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }

  // Assets: serve from cache immediately, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

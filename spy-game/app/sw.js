// Service worker: cache-first for the app shell and content (100% offline after the first load).
// Cross-origin requests (Supabase) are not intercepted: they always hit the network.
const VERSION = 'mj-v1.1.0';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/fonts.css',
  'css/tokens.css',
  'css/app.css',
  'js/app.js',
  'js/state.js',
  'js/router.js',
  'js/game.js',
  'js/sync.js',
  'js/supabase.js',
  'js/ui/dom.js',
  'js/ui/icons.js',
  'js/ui/fx.js',
  'js/ui/setup.js',
  'js/ui/round.js',
  'js/ui/extras.js',
  'js/ui/online.js',
  'js/ui/hold.js',
  'assets/vendor/qrcode.js',
  'js/config.js',
  'content/packs.json',
  'assets/fonts/reem-kufi-700-arabic.woff2',
  'assets/fonts/reem-kufi-700-latin.woff2',
  'assets/fonts/ibm-plex-sans-arabic-400-arabic.woff2',
  'assets/fonts/ibm-plex-sans-arabic-400-latin.woff2',
  'assets/fonts/ibm-plex-sans-arabic-600-arabic.woff2',
  'assets/fonts/ibm-plex-sans-arabic-600-latin.woff2',
  'assets/fonts/aref-ruqaa-700-arabic.woff2',
  'assets/fonts/special-elite-400.woff2',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase and every other origin go straight to the network (auth, realtime, RPC must never be cached).
  // Downloaded packs are cached by the app itself in localStorage.
  if (url.origin !== self.location.origin) return;

  // Navigations (including ?room=ABCD deep links) → cached app shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html').then(
        (cached) =>
          cached ||
          fetch(req).catch(() => new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
      )
    );
    return;
  }

  // Static assets: cache-first, then network (and store what we fetched).
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

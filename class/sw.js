/* Class app offline support.
   Network first, so a new version shows up the next time the app opens with
   a connection; the last copy that loaded is kept for when there is none.
   Decks and pictures are not in here - they live in IndexedDB (see store.js). */
var CACHE = 'class-shell-v1';
var SHELL = ['./', 'index.html', 'class.css', 'app.js', 'pptx.js', 'zip.js', 'render.js',
             'present.js', 'store.js', 'manifest.webmanifest',
             'fonts/comic-neue-latin-400-normal.woff2', 'fonts/comic-neue-latin-400-italic.woff2',
             'fonts/comic-neue-latin-700-normal.woff2', 'fonts/comic-neue-latin-700-italic.woff2',
             'icons/icon-192.png', 'icons/icon-180.png',
             '/assets/logo/option-c-badge.svg', '/assets/fonts/fredoka-latin.woff2', '/favicon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('class-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || caches.match('./');
    });
  }));
});

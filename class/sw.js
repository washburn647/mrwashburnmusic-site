/* Class app offline support.
   Network first, so a new version shows up the next time the app opens with
   a connection; the last copy that loaded is kept for when there is none, or
   when the network takes more than 3 seconds.
   Decks and pictures are not in here - they live in IndexedDB (see store.js). */
var CACHE = 'class-shell-v11';
var SHELL = ['./', 'index.html', 'class.css', 'app.js', 'pptx.js', 'zip.js', 'render.js',
             'present.js', 'store.js', 'marks.js', 'editor.js', 'ui.js', 'menus.js', 'planner.js', 'plans.js', 'builder.js', 'xlsx.js', 'widgets.js', 'calendar.js', 'lists.js', 'sync.js', 'library.js', 'subs.js', 'subsongs.js', 'manifest.webmanifest',
             'fonts/comic-neue-latin-400-normal.woff2', 'fonts/comic-neue-latin-400-italic.woff2',
             'fonts/comic-neue-latin-700-normal.woff2', 'fonts/comic-neue-latin-700-italic.woff2',
             'icons/icon-192.png', 'icons/icon-180.png',
             '/assets/logo/option-f-notes-badge.svg', '/assets/fonts/fredoka-latin.woff2', '/favicon.svg'];

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
  var url = new URL(req.url);
  // The website's copy of decks and plans (/api/) is never cached here.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.indexOf('/api/') === 0) return;
  // Slow school wifi: after 3 seconds the last copy answers, and the network's answer
  // (when it comes) is kept for next time.
  var net = fetch(req).then(function (res) {
    if (res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  });
  var cached = function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || (req.mode === 'navigate' ? caches.match('./') : undefined);
    });
  };
  e.waitUntil(net.catch(function () {}));
  e.respondWith(new Promise(function (resolve, reject) {
    var done = false;
    var finish = function (res) { if (!done && res) { done = true; resolve(res); } };
    var timer = setTimeout(function () { cached().then(finish); }, 3000);
    net.then(function (res) { clearTimeout(timer); finish(res); }, function () {
      clearTimeout(timer);
      cached().then(function (hit) { if (hit) finish(hit); else if (!done) { done = true; reject(new Error('offline')); } });
    });
  }));
});

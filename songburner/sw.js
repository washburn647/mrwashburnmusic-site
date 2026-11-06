/* Song Burner offline support.
   Network first, so a new build shows up the next time you open the app with
   a connection; the last copy that loaded is kept for when there is none.
   Songs and scores are not in here - they live in IndexedDB (see host.js). */
var CACHE = 'songburner-shell-v1';
var SHELL = ['./', 'index.html', 'host.js', 'engine.js', 'app.js', 'fonts.css',
             'manifest.webmanifest', 'backup/', 'backup/backup.js',
             'fonts/bebas-neue-latin.woff2', 'fonts/inter-var-latin.woff2',
             'fonts/ibm-plex-mono-400-latin.woff2', 'fonts/ibm-plex-mono-500-latin.woff2',
             'fonts/ibm-plex-mono-600-latin.woff2', 'icons/icon-180.png',
             'icons/icon-192.png', 'icons/icon-32.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('songburner-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Network first, but a slow connection does not hold the app hostage: after
   SLOW ms the saved copy is used if there is one, and the network answer, when
   it comes, still refreshes the saved copy for next time. */
var SLOW = 2500;
/* Once one request has waited that long, the connection is bad: for the next
   little while everything else that is saved is served at once instead of
   each file waiting its own 2.5 seconds. */
var slowUntil = 0;

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
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
  e.respondWith(new Promise(function (resolve, reject) {
    var done = false;
    function finish(res) { if (!done && res) { done = true; resolve(res); } }
    var timer = setTimeout(function () {
      slowUntil = Date.now() + 15000;
      cached().then(finish);
    }, Date.now() < slowUntil ? 0 : SLOW);
    net.then(function (res) { clearTimeout(timer); slowUntil = 0; finish(res); }, function (err) {
      clearTimeout(timer);
      cached().then(function (hit) {
        if (hit) finish(hit);
        else if (!done) { done = true; reject(err); }
      });
    });
  }));
  e.waitUntil(net.catch(function () {}));
});

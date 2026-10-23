// Service worker: syarat agar bisa dipasang sebagai aplikasi (PWA) di Android.
// Halaman selalu diambil dari server dulu; salinan hanya dipakai kalau server
// tidak terjangkau saat TV baru dinyalakan. /api/ tidak pernah disentuh,
// jadi token tidak mungkin usang karena cache.
var CACHE = 'tka-shell-v1';
var SHELL = [
  '/', '/style.css', '/config.js', '/common.js', '/display.js',
  '/fonts/nunito-latin-600-normal.woff2', '/fonts/nunito-latin-800-normal.woff2',
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.indexOf('/api/') === 0) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(function (res) {
    if (res.ok && SHELL.indexOf(url.pathname) !== -1) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) { return hit || Response.error(); });
  }));
});

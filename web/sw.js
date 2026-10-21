/* Офлайн-кэш оболочки. Данные пользователя здесь не хранятся: они лежат в IndexedDB в зашифрованном виде. */
const VERSION = 'zdorovie-v2';
const SHELL = [
  './', 'index.html', 'model.js', 'app.js', 'manifest.webmanifest', 'fonts/fonts.css',
  'fonts/GolosText-cyrillic.woff2', 'fonts/GolosText-latin.woff2',
  'fonts/Unbounded-cyrillic.woff2', 'fonts/Unbounded-latin.woff2',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isCode = req.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(new URL(req.url).pathname);
  if (isCode) {
    // Сначала сеть, чтобы обновления приходили сразу; без сети — из кэша.
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});

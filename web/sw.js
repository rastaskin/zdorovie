/* Офлайн-кэш оболочки. Данные пользователя здесь не хранятся: они лежат в IndexedDB в зашифрованном виде. */
const VERSION = 'zdorovie-v4';
const SHELL = [
  './', 'index.html', 'config.js', 'model.js', 'sync.js', 'app.js', 'manifest.webmanifest', 'fonts/fonts.css',
  'fonts/Kurale-400-cyrillic.woff2', 'fonts/Kurale-400-latin.woff2',
  'fonts/AlegreyaSansSC-400-cyrillic.woff2', 'fonts/AlegreyaSansSC-400-latin.woff2',
  'fonts/AlegreyaSansSC-500-cyrillic.woff2', 'fonts/AlegreyaSansSC-500-latin.woff2',
  'fonts/MarckScript-400-cyrillic.woff2', 'fonts/MarckScript-400-latin.woff2',
  'ui/wood.webp', 'ui/parchment.webp', 'ui/panel.webp', 'ui/divider.webp',
  'ui/sh/timeline.webp', 'ui/sh/saved.webp', 'ui/sh/glossary.webp', 'ui/sh/perfume.webp', 'ui/sh/era.webp', 'ui/sh/herbal.webp',
  'ui/ic/book.webp', 'ui/ic/crown.webp', 'ui/ic/hourglass.webp', 'ui/ic/herb.webp', 'ui/ic/rose.webp', 'ui/ic/flask.webp', 'ui/ic/cross.webp', 'ui/ic/compass.webp', 'ui/ic/tower.webp', 'ui/ic/swords.webp', 'ui/ic/helmet.webp', 'ui/ic/lute.webp', 'ui/ic/keg.webp', 'ui/ic/mortar.webp', 'ui/ic/serpent.webp', 'ui/ic/bread.webp',
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

/* Service Worker：小越背单词 App 离线缓存 */
const VER = 'xiaoyue-v277';
const SHELL = [
  './', './index.html', './css/app.css', './css/cute.css', './css/path.css', './css/theme.css', './css/design-system.css', './css/design-v2.css', './js/app.js', './js/icons.js', './js/core.js', './js/quiz.js',
  './manifest.webmanifest', './data/books/index.json', './data/books/es.json', './icons/icon-192.png', './icons/icon-512.png', './fonts/xiaoyue-hand.woff2', './fonts/xiaoyue-title.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER).then(c => Promise.all(
      SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { }))
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 代码类资源：网络优先 —— 改完刷新就生效 */
function isCode(url) {
  return /\.(css|js)$/i.test(url.pathname) || /\/index\.html$/.test(url.pathname) || url.pathname === '/';
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // ① 页面 / CSS / JS：网络优先，失败才用缓存
  if (isCode(url)) {
    e.respondWith(
      fetch(new Request(req, { cache: 'no-store' }))
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VER).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // ② data 资源：网络优先，失败回退缓存
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VER).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // ③ 其他静态资源：缓存优先
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VER).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

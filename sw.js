/* Service Worker：小越背单词 App 离线缓存 */
const VER = 'xiaoyue-v332';
const SHELL = [
  './js/ise.js',
  './js/voice.js',
  './js/pronlab.js',
  './css/shadowing.css', './js/shadowing.js',
  './css/reading.css', './js/reading.js', './data/reading.json', './data/reading-archive.json',
  './', './index.html', './css/app.css', './css/cute.css', './css/path.css', './css/theme.css', './css/design-system.css', './css/design-v2.css', './js/app.js', './js/icons.js', './js/core.js', './js/reading.js',
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

/* 浠ｇ爜绫昏祫婧愶細缃戠粶浼樺厛 鈥斺€?鏀瑰畬鍒锋柊灏辩敓鏁?*/
function isCode(url) {
  return /\.(css|js)$/i.test(url.pathname) || /\/index\.html$/.test(url.pathname) || url.pathname === '/';
}

/* 鏀跺埌涓荤嚎绋嬫寚浠わ細绔嬪埢鎺ョ锛屼笉鍐嶇瓑鏃ч〉闈㈠叧闂?*/
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 鈶?椤甸潰 / CSS / JS锛氱綉缁滀紭鍏堬紝澶辫触鎵嶇敤缂撳瓨
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

  // 鈶?data 璧勬簮锛氱綉缁滀紭鍏堬紝澶辫触鍥為€€缂撳瓨
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

  // 鈶?鍏朵粬闈欐€佽祫婧愶細缂撳瓨浼樺厛
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

/* =========================================================
   Service Worker — تطبيق «تفسير جزء عم — تدبّر وعمل»
   يعمل دون اتصال بالإنترنت بعد أول فتح
   ========================================================= */
const VERSION = 'juz-amma-v5';
const CORE_CACHE = VERSION + '-core';
const RUNTIME_CACHE = VERSION + '-runtime';

/* ملفات الموقع الأساسية */
const CORE = [
  './',
  './index.html',
  './quiz.html',
  './styles.css',
  './app.js',
  './exam.js',
  './quiz.js',
  './surahs-data.js',
  './pwa.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

/* ---------- التثبيت: تخزين كل الملفات ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

/* ---------- التفعيل: حذف النسخ القديمة ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CORE_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

/* ---------- استراتيجيات الجلب ---------- */

/* ملفات الموقع: من الذاكرة أولًا ثم تحديث في الخلفية */
function cacheFirst(request, cacheName) {
  return caches.match(request).then((cached) => {
    const network = fetch(request).then((res) => {
      /* نفس المصدر: basic — ومصدر خارجي بلا CORS: opaque (نحفظه للخطوط) */
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => cached);
    return cached || network;
  });
}

/* صفحات التنقل: الشبكة أولًا ثم النسخة المحفوظة */
function networkFirst(request) {
  return fetch(request)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
      }
      return res;
    })
    .catch(() => caches.match(request).then((cached) => {
      return cached || caches.match('./index.html');
    }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* خطوط Google: نخزّنها ليعمل الموقع بشكله كاملًا دون إنترنت */
  if (url.origin !== self.location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    }
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }

  /* ملف العامل نفسه لا يُقدَّم من الذاكرة أبدًا (وإلا توقف التحديث) */
  if (/sw\.js$/.test(url.pathname)) {
    event.respondWith(fetch(req));
    return;
  }

  /* ملف التعريف يُقرأ من الشبكة أولًا ثم يُحفظ */
  if (/manifest\.webmanifest$/.test(url.pathname)) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CORE_CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(cacheFirst(req, CORE_CACHE));
});

/* ---------- رسالة من الصفحة: تحديث فوري ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
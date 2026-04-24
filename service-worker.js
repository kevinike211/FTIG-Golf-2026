// Service Worker for FTIG Golf 2026 PWA
const CACHE_NAME = 'ftig-golf-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './our-teams.html',
  './manifest.json',
  './manifest-our-teams.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];

// Install: pre-cache shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy:
//   - Firebase APIs: always network (with cache fallback offline)
//   - HTML and the manifest: network-first so updates appear immediately
//   - Everything else (fonts, icons, Firebase SDK scripts): cache-first for speed
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase API: always go to network
  if (url.includes('firestore.googleapis.com') ||
      url.includes('identitytoolkit.googleapis.com') ||
      url.includes('securetoken.googleapis.com')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // HTML pages and manifests: network-first with cache fallback
  const isHTMLorManifest = event.request.destination === 'document' ||
                           url.endsWith('.html') || url.endsWith('/') ||
                           url.includes('manifest') && url.endsWith('.json');
  if (isHTMLorManifest) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else (fonts, icons, Firebase SDK)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && (event.request.url.startsWith(self.location.origin) || url.includes('gstatic.com') || url.includes('googleapis.com'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

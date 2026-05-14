const CACHE = 'physioref-v2';

const CORE = [
  './',
  './index.html',
  './renderer.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './data/msk-shoulder.js',
  './data/msk-elbow.js',
  './data/msk-wrist.js',
  './data/msk-cervical.js',
  './data/msk-lumbar.js',
  './data/msk-hip.js',
  './data/msk-knee.js',
  './data/msk-foot.js',
  './data/msk-inflammatory.js',
  './data/cvr-cardiac.js',
  './data/cvr-respiratory.js',
  './data/cvr-vascular.js',
  './data/neuro-cns.js',
  './data/neuro-pns.js',
  './data/neuro-vestibular.js',
  './data/neuro-neuromuscular.js',
];

// Pre-cache everything on first install so the app works offline immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first: always try the network, update the cache, fall back to
// cache only when offline. This means new deployments are picked up
// automatically the next time the app is opened with any connectivity.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

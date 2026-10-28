// Offline support for the web version.
// Pages: network first (updates arrive right away), local copy when offline.
// App files (fingerprinted names, so never modified): local copy first.
// Natural voice engine (CDN, pinned versions): local copy first too, for offline use.
// The voices themselves are kept by the library in the browser's storage.
const CACHE = 'passeport-civique-v2';
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon.svg', './icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const cdn = CDN.includes(url.hostname);
  if (req.method !== 'GET' || (url.origin !== self.location.origin && !cdn)) return; // Ollama and the rest: left alone
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./', copy));
      return res;
    }).catch(() => caches.match('./')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});

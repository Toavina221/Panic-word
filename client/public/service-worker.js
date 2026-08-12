/* PANIC WORD — Service Worker (offline-first) */
const CACHE_NAME = "panicword-v1";
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/data/fr.json",
  "/data/en.json",
  "/data/es.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* Stratégie : réseau d'abord, cache sinon (stale-while-revalidate pour assets). */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Ne pas intercepter les appels tRPC / analytics
  if (url.pathname.startsWith("/api/")) return;

  // Assets immuables : cache first
  if (/\.(js|css|png|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit ?? fetchAndCache(event.request)),
    );
    return;
  }

  // Navigation & JSON : réseau d'abord, fallback cache (fonctionnement hors-ligne)
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && event.request.method === "GET") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match("/"))),
  );
});

function fetchAndCache(request) {
  return fetch(request).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return res;
  });
}

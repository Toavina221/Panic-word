/* PANIC WORD — Service Worker (offline-first) */
const CACHE_NAME = "panicword-v2";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/service-worker.js",
  "/data/fr.json",
  "/data/en.json",
  "/data/es.json",
  "/data/mg.json",
  "/data/de.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
  "/screenshots/screenshot-home.png",
  "/screenshots/screenshot-modes.png",
  "/screenshots/screenshot-game.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Précacher tout ce qui est accessible ; ne pas bloquer l'install sur
      // une ressource absente (ex. déploiement en cours d'écriture).
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch(() => {
              console.warn("[SW] Precache échoué pour", url);
            }),
          ),
        ),
      )
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
  // Ne pas intercepter les appels tRPC / analytics, ni le re-fetch du SW lui-même
  if (url.pathname.startsWith("/api/") || url.pathname === "/service-worker.js") return;

  // Assets immuables : cache first
  if (/\.(js|css|png|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit ?? fetchAndCache(event.request)),
    );
    return;
  }

  // Navigation & JSON : réseau d'abord, fallback cache (fonctionnement hors-ligne)
  // Pour la navigation, ignorer les redirections internes (POST /api/…) et les méthodes non GET
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => {
        const pageFallback = url.pathname.startsWith("/icons") || url.pathname.startsWith("/data")
          ? caches.match(event.request)
          : caches.match("/index.html").then((hit) => hit || caches.match("/"));
        return pageFallback;
      }),
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

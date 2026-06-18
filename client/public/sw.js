// DinoInvest Service Worker — offline app shell + public data caching
//
// SECURITY NOTE: Only public, non-authenticated API responses are cached here.
// User-specific authenticated endpoints (/api/profiles/me, /api/quests, etc.)
// are intentionally excluded to prevent cross-user data leakage on shared devices.
// Offline quiz review of personal data should use device-local IndexedDB storage.
const CACHE_VERSION = "dinoinvest-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PUBLIC_API_CACHE = `${CACHE_VERSION}-public-api`;

// Static assets to cache on install (app shell)
const PRECACHE_URLS = [
  "/",
  "/index.html",
];

// Only public, non-user-specific API routes are safe to cache by URL.
// Market news is the same for all users — safe to cache.
const PUBLIC_API_PATTERNS = [
  /^\/api\/news$/,
  /^\/api\/exchange-rate$/,
  /^\/api\/economic-calendar/,
];

// ── Install: precache app shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("dinoinvest-") && k !== STATIC_CACHE && k !== PUBLIC_API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch handler ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (url.origin !== self.location.origin || request.method !== "GET") return;

  const isPublicApi = PUBLIC_API_PATTERNS.some((p) => p.test(url.pathname));

  if (isPublicApi) {
    // Network-first for public API data, fall back to cache when offline
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(PUBLIC_API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (JS, CSS, fonts, images): cache-first, network fallback
  if (!url.pathname.startsWith("/api/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.type !== "opaque") {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }

  // All other /api/* requests (authenticated, user-specific): pass through without caching
});

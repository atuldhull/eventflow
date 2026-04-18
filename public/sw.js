// EventFlow service worker
// Primary goal: make /dashboard/tickets usable offline so attendees can show
// their QR at a venue with no signal.
const CACHE_NAME = "eventflow-v2"
const OFFLINE_URL = "/offline"

// Assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/events",
  "/dashboard",
  "/dashboard/tickets",
  "/offline",
]

// APIs whose JSON response we want available offline (stale-while-revalidate).
// Keep this list tight — we don't want to leak stale data for things users
// expect to be live (payments, notifications).
const OFFLINE_CACHEABLE_API_PREFIXES = [
  "/api/users/me/tickets",
]

function shouldCacheApi(pathname) {
  return OFFLINE_CACHEABLE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

// Install: pre-cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch handler
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin GETs
  if (event.request.method !== "GET") return
  if (url.origin !== self.location.origin) return

  // Allowlisted APIs: stale-while-revalidate
  if (url.pathname.startsWith("/api/")) {
    if (!shouldCacheApi(url.pathname)) return  // Default: network-only (no caching)

    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        const networkPromise = fetch(event.request)
          .then((response) => {
            // Only cache successful JSON responses to avoid storing 401/500 bodies
            if (response && response.ok) {
              cache.put(event.request, response.clone()).catch(() => {})
            }
            return response
          })
          .catch(() => null)

        if (cached) {
          // Fire and forget the network update
          networkPromise.catch(() => {})
          return cached
        }
        const network = await networkPromise
        if (network) return network
        return new Response(
          JSON.stringify({ success: false, message: "Offline and no cached response available" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      })
    )
    return
  }

  // Ticket page: stale-while-revalidate against the cache so the HTML shell
  // is still available offline.
  if (url.pathname.startsWith("/dashboard/tickets")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(event.request)
          if (response && response.ok) cache.put(event.request, response.clone()).catch(() => {})
          return response
        } catch {
          const cached = await cache.match(event.request)
          return cached || cache.match(OFFLINE_URL) || new Response("Offline", { status: 503 })
        }
      })
    )
    return
  }

  // Static assets: cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {})
          }
          return response
        })
      )
    )
    return
  }

  // Other HTML/navigation: network-first with offline fallback
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL))
    )
  )
})

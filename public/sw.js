// EventFlow service worker
// Primary goal: make /dashboard/tickets usable offline so attendees can show
// their QR at a venue with no signal.
//
// DEV SAFETY: on localhost/127.0.0.1, the SW unregisters itself and clears
// its caches on activate. This prevents a previously-registered prod SW from
// intercepting requests during `next dev` and serving the offline fallback
// instead of the live page.
const CACHE_NAME = "eventflow-v3"
const OFFLINE_URL = "/offline"
const IS_DEV_HOST = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1"

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

// Activate: clean up old caches. On dev hosts, go further — blow away every
// cache and unregister ourselves so the tab reloads into the normal flow.
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    if (IS_DEV_HOST) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: "window" })
      clients.forEach((c) => { try { (c).navigate(c.url) } catch {} })
      return
    }
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
  })())
  self.clients.claim()
})

// Fetch handler
self.addEventListener("fetch", (event) => {
  // Dev: never intercept. The browser goes direct to the server.
  if (IS_DEV_HOST) return

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

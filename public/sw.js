const CACHE_NAME = "eventflow-v1"
const OFFLINE_URL = "/offline"

// Assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/events",
  "/dashboard",
  "/dashboard/tickets",
  "/offline",
]

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

// Fetch: network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET requests
  if (event.request.method !== "GET") return

  // API requests: network only (don't cache dynamic data)
  if (url.pathname.startsWith("/api/")) return

  // For ticket pages: cache aggressively for offline access
  if (url.pathname.startsWith("/dashboard/tickets")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(event.request)
          cache.put(event.request, response.clone())
          return response
        } catch {
          const cached = await cache.match(event.request)
          return cached || new Response("Offline — showing cached ticket", { status: 503 })
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
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      )
    )
    return
  }

  // HTML pages: network-first with offline fallback
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL))
    )
  )
})

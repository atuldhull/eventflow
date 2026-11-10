// EventFlow service worker
// Primary goal: make /dashboard/tickets usable offline so attendees can show
// their QR at a venue with no signal.
//
// What is cached here: page shells (HTML) and static assets (JS/CSS/fonts/images).
// What is NOT cached here: API responses. The tickets themselves are kept by the
// tickets page on the device (src/lib/offline-tickets.ts), keyed to the signed-in
// user and cleared on sign-out, so a shared device never shows the previous
// user's tickets from this cache.
//
// DEV SAFETY: on localhost/127.0.0.1, the SW unregisters itself and clears
// its caches on activate. This prevents a previously-registered prod SW from
// intercepting requests during `next dev` and serving the offline fallback
// instead of the live page.
const CACHE_NAME = "eventflow-v4"
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

// Signed-in pages whose last good HTML is kept for offline use
const OFFLINE_PAGE_PREFIXES = ["/dashboard/tickets"]

// On a slow venue network ("lie-fi"), serve the cached ticket page after this long
const NAVIGATION_TIMEOUT_MS = 5000

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)
}

// Next.js client-side navigation fetches (RSC payloads) for a page URL
function isRscRequest(request, url) {
  return request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")
}

// Install: pre-cache core assets
self.addEventListener("install", (event) => {
  // One by one, skipping failures: a signed-out visitor is redirected from /dashboard to
  // /login, and that redirected page must not be stored as the dashboard.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(PRECACHE_URLS.map(async (u) => {
      try {
        const response = await fetch(u, { credentials: "same-origin" })
        if (response.ok && !response.redirected) await cache.put(u, response)
      } catch {}
    })))
  )
  self.skipWaiting()
})

// Activate: clean up old caches (v3 also held API responses). On dev hosts, go
// further — blow away every cache and unregister ourselves so the tab reloads
// into the normal flow.
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

// The page that registered us lists the scripts/styles it already loaded (before this
// worker controlled it), so they are cached too and the page opens offline next time.
self.addEventListener("message", (event) => {
  const data = event.data
  if (IS_DEV_HOST || !data || data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return
  const urls = data.urls
    .map((u) => { try { return new URL(u, self.location.origin) } catch { return null } })
    .filter((u) => u && u.origin === self.location.origin && isStaticAsset(u))
    .slice(0, 300)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(urls.map(async (u) => {
      if (await cache.match(u.href)) return
      try {
        const response = await fetch(u.href)
        if (response && response.ok) await cache.put(u.href, response)
      } catch {}
    })))
  )
})

// Fetch handler
self.addEventListener("fetch", (event) => {
  // Dev: never intercept. The browser goes direct to the server.
  if (IS_DEV_HOST) return

  const url = new URL(event.request.url)

  // Only handle same-origin GETs
  if (event.request.method !== "GET") return
  if (url.origin !== self.location.origin) return

  // APIs: network-only, never cached here (personal data; see the note at the top)
  if (url.pathname.startsWith("/api/")) return

  // Ticket page: network-first; the last good HTML is kept so the page opens offline
  // (and the session check in middleware is never reached without a network).
  if (OFFLINE_PAGE_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    // RSC payloads: network-only. If they fail, Next.js falls back to a full page
    // load, which lands in the branch below and is served from the cache.
    if (isRscRequest(event.request, url)) return
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(url.pathname, { ignoreVary: true })
        const network = fetch(event.request).then((response) => {
          // response.ok: a redirect to /login (signed out) or an error page is never cached
          if (response && response.ok && response.type === "basic") cache.put(url.pathname, response.clone()).catch(() => {})
          return response
        })
        try {
          if (!cached) return await network
          const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS))
          const winner = await Promise.race([network, timeout])
          if (winner) return winner
          network.catch(() => {})
          return cached
        } catch {
          return cached || (await cache.match(OFFLINE_URL)) || new Response("Offline", { status: 503 })
        }
      })
    )
    return
  }

  // Static assets: cache-first
  if (isStaticAsset(url)) {
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

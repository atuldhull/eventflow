"use client"

import { useEffect } from "react"

export function PWARegister() {
  useEffect(() => {
    // public/sw.js unregisters itself on localhost and reloads the tab (so a stale worker never
    // sticks to a developer's machine). Registering it there again would reload forever, so a
    // production build opened on localhost (e.g. `docker compose up` on a laptop) skips it.
    const devHost = location.hostname === "localhost" || location.hostname === "127.0.0.1"
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production" && !devHost) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          // On the first visit this page loaded its scripts before the worker took control,
          // so hand it the list: the page then opens offline from the next visit on.
          const urls = performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((name) => name.startsWith(location.origin + "/_next/static/"))
          registration.active?.postMessage({ type: "CACHE_URLS", urls })
        })
        .catch(() => {
          // Service worker registration failed — non-critical
        })
    }
  }, [])

  return null
}

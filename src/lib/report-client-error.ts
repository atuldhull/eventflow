/** Sends a browser crash to /api/client-errors (best effort, never throws). */
export function reportClientError(error: Error & { digest?: string }) {
  try {
    const body = JSON.stringify({
      message: String(error?.message ?? "Unknown error").slice(0, 500),
      stack: error?.stack?.slice(0, 4000),
      digest: error?.digest,
      path: typeof window !== "undefined" ? window.location.pathname.slice(0, 300) : undefined,
    })
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/client-errors", new Blob([body], { type: "application/json" }))
    } else {
      void fetch("/api/client-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {})
    }
  } catch {
    // nothing to do
  }
}

"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/report-client-error"

// Shown only when the root layout itself crashes, so it can't use the app's components or
// styles: a plain page with a way back.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#fafafa", color: "#1a1a1a" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#555", fontSize: 15, margin: "0 0 20px" }}>The page couldn&apos;t load. Please try again.</p>
          <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", fontSize: 15, cursor: "pointer" }}>
            Try again
          </button>
          {/* a full page load, not client navigation, since the app shell is broken */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point: the app shell is broken */}
          <p style={{ marginTop: 16 }}><a href="/" style={{ color: "#0f766e" }}>Go to the home page</a></p>
        </main>
      </body>
    </html>
  )
}

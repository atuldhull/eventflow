"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/report-client-error"

// Shown only when the root layout itself crashes, so it can't use the app's components or
// styles: a self-contained page in the brand colours (charcoal, lemon, lavender) with a way back.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#171717",
          color: "#f5f5f4",
        }}
      >
        <main style={{ maxWidth: 480, padding: 24 }}>
          <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#a66bff" }}>
            EventFlow
          </p>
          <h1 style={{ fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.04em", fontWeight: 800, margin: "0 0 14px" }}>
            Something went{" "}
            <span style={{ background: "#fff21a", color: "#171717", padding: "0 0.12em", borderRadius: "0.16em", display: "inline-block", transform: "rotate(-1.5deg)" }}>
              wrong
            </span>
          </h1>
          <p style={{ color: "#b3b3b3", fontSize: 17, lineHeight: 1.6, margin: "0 0 28px" }}>The page couldn&apos;t load. Please try again.</p>
          <button
            onClick={reset}
            style={{ height: 48, padding: "0 24px", borderRadius: 999, border: 0, background: "#fff21a", color: "#171717", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
          {/* a full page load, not client navigation, since the app shell is broken */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point: the app shell is broken */}
          <p style={{ marginTop: 20 }}><a href="/" style={{ color: "#a66bff", fontWeight: 600 }}>Go to the home page</a></p>
        </main>
      </body>
    </html>
  )
}

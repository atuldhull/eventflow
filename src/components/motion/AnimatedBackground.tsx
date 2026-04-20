"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

/**
 * Ambient, always-on background — slow-drifting color blobs under a fine SVG
 * noise overlay. Sits behind everything (z-index negative), pointer-events
 * none. Inspired by Linear / Stripe ambient UIs: you feel the motion
 * peripherally without ever looking at it.
 *
 * Pure CSS animations — no JS RAF loop — so we pay zero frame budget on
 * the main thread. Blobs are `filter: blur` on transform, which stays on the
 * compositor thread.
 *
 * `intensity`:
 *   "ambient"  (default) — low-opacity, slow, works under any content
 *   "marketing" — brighter, for landing / hero sections
 *   "minimal"  — single subtle gradient, for dense pages like the dashboard
 *
 * `theme`:
 *   "indigo" | "emerald" | "amber" | "rose"
 */
interface Props {
  intensity?: "ambient" | "marketing" | "minimal"
  theme?: "indigo" | "emerald" | "amber" | "rose"
  className?: string
}

const themes = {
  indigo: ["#6366f1", "#8b5cf6", "#3b82f6"],
  emerald: ["#10b981", "#14b8a6", "#22d3ee"],
  amber: ["#f59e0b", "#f97316", "#ef4444"],
  rose: ["#f43f5e", "#ec4899", "#8b5cf6"],
}

export function AnimatedBackground({
  intensity = "ambient",
  theme = "indigo",
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const colors = themes[theme]
  const opacity = intensity === "marketing" ? 0.55 : intensity === "minimal" ? 0.15 : 0.28

  useEffect(() => {
    // Honor reduced-motion — freeze the background in place.
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      el.style.animation = "none"
      el.querySelectorAll(".animated-bg-blob").forEach((b) => {
        (b as HTMLElement).style.animation = "none"
      })
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className
      )}
      style={{ opacity }}
    >
      {/* Blob 1 */}
      <div
        className="animated-bg-blob absolute h-[60vw] w-[60vw] rounded-full blur-[100px] mix-blend-normal dark:mix-blend-screen"
        style={{
          backgroundColor: colors[0],
          top: "-15%",
          left: "-10%",
          animation: "animated-bg-drift-1 28s ease-in-out infinite alternate",
        }}
      />
      {/* Blob 2 */}
      {intensity !== "minimal" && (
        <div
          className="animated-bg-blob absolute h-[55vw] w-[55vw] rounded-full blur-[110px] mix-blend-normal dark:mix-blend-screen"
          style={{
            backgroundColor: colors[1],
            top: "30%",
            right: "-12%",
            animation: "animated-bg-drift-2 34s ease-in-out infinite alternate",
          }}
        />
      )}
      {/* Blob 3 */}
      {intensity === "marketing" && (
        <div
          className="animated-bg-blob absolute h-[50vw] w-[50vw] rounded-full blur-[100px] mix-blend-normal dark:mix-blend-screen"
          style={{
            backgroundColor: colors[2],
            bottom: "-15%",
            left: "25%",
            animation: "animated-bg-drift-3 26s ease-in-out infinite alternate",
          }}
        />
      )}

      {/* Fine noise overlay — breaks up gradient banding */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.045]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />
    </div>
  )
}

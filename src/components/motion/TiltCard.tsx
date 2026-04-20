"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

/**
 * 3D-tilt effect driven by mouse position inside the card, plus a soft
 * cursor-tracked highlight. Inspired by Linear's project cards and Apple
 * product grids. Disabled on coarse pointers and reduced-motion.
 */
interface Props {
  children: React.ReactNode
  className?: string
  /** Max tilt in degrees. 8 is subtle, 14 is "whoa", above 18 gets nauseating. */
  maxTilt?: number
  /** Whether to add a cursor-tracking glow overlay. */
  glow?: boolean
}

export function TiltCard({ children, className, maxTilt = 8, glow = true }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    if (typeof window === "undefined") return
    if (window.matchMedia("(pointer: coarse)").matches) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    el.style.transformStyle = "preserve-3d"
    el.style.willChange = "transform"

    let rafId = 0
    let targetRx = 0
    let targetRy = 0
    let currentRx = 0
    let currentRy = 0
    let targetGlowX = 50
    let targetGlowY = 50
    let currentGlowX = 50
    let currentGlowY = 50
    let active = false

    const onEnter = () => { active = true }
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width  // 0–1
      const py = (e.clientY - rect.top) / rect.height  // 0–1
      // Invert Y: cursor at top tilts card back (rotateX positive).
      targetRx = (0.5 - py) * 2 * maxTilt
      targetRy = (px - 0.5) * 2 * maxTilt
      targetGlowX = px * 100
      targetGlowY = py * 100
    }
    const onLeave = () => {
      active = false
      targetRx = 0
      targetRy = 0
    }

    const tick = () => {
      currentRx += (targetRx - currentRx) * 0.12
      currentRy += (targetRy - currentRy) * 0.12
      currentGlowX += (targetGlowX - currentGlowX) * 0.12
      currentGlowY += (targetGlowY - currentGlowY) * 0.12
      el.style.transform = `perspective(900px) rotateX(${currentRx}deg) rotateY(${currentRy}deg)`
      if (glow) {
        el.style.setProperty("--tilt-glow-x", `${currentGlowX}%`)
        el.style.setProperty("--tilt-glow-y", `${currentGlowY}%`)
        el.style.setProperty("--tilt-glow-opacity", active ? "1" : "0")
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    el.addEventListener("mouseenter", onEnter)
    el.addEventListener("mousemove", onMove, { passive: true })
    el.addEventListener("mouseleave", onLeave)

    return () => {
      cancelAnimationFrame(rafId)
      el.removeEventListener("mouseenter", onEnter)
      el.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseleave", onLeave)
      el.style.transform = ""
      el.style.willChange = ""
    }
  }, [maxTilt, glow])

  return (
    <div
      ref={rootRef}
      className={cn("tilt-card relative", className)}
      style={{ transition: "box-shadow 0.3s ease" }}
    >
      {children}
      {glow && (
        <div
          className="tilt-card-glow pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300"
          style={{
            background: "radial-gradient(450px circle at var(--tilt-glow-x, 50%) var(--tilt-glow-y, 50%), rgba(var(--tilt-glow-color, 99 102 241) / 0.14), transparent 45%)",
            opacity: "var(--tilt-glow-opacity, 0)",
          }}
        />
      )}
    </div>
  )
}

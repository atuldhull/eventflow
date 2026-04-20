"use client"

import { useEffect, useRef } from "react"

/**
 * Premium cursor — a small filled dot that tracks the real pointer, plus a
 * thin ring that follows with a damped lag and inflates when hovering any
 * interactive element.
 *
 * Accessibility rules (hard-coded, not optional):
 *   1. Never renders on coarse pointers (touch). Native taps unaffected.
 *   2. Respects prefers-reduced-motion — disabled entirely.
 *   3. Does NOT hide the native cursor with cursor: none. The custom cursor
 *      layers ON TOP as an enhancement; the real cursor still renders
 *      underneath for users with pointer-tracking assistive tools.
 *      (Many "premium" cursor demos hide the native cursor. Don't.)
 *   4. Keyboard focus outlines are untouched — this is purely a mouse
 *      enhancement. Focus-visible rings keep working.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(pointer: coarse)").matches) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let rafId = 0
    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let ringX = mouseX
    let ringY = mouseY
    let ringScale = 1
    let targetScale = 1
    let visible = false

    // Keep the dot pinned to the real pointer (no lag) and the ring follows
    // with damping. This doubled motion — snappy dot + lazy ring — reads as
    // "precision + polish" rather than one slow-following blob.
    const onMove = (e: PointerEvent) => {
      if (!visible) {
        visible = true
        dot.style.opacity = "1"
        ring.style.opacity = "1"
      }
      mouseX = e.clientX
      mouseY = e.clientY
      dot.style.transform = `translate3d(${mouseX - 3}px, ${mouseY - 3}px, 0)`
    }

    const interactiveSelector = "a, button, [role='button'], input, select, textarea, label, summary, [data-cursor='hover']"

    const onPointerOver = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest(interactiveSelector)) {
        targetScale = 2.2
        ring.dataset.hover = "true"
      }
    }
    const onPointerOut = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest(interactiveSelector)) {
        targetScale = 1
        ring.dataset.hover = "false"
      }
    }
    const onLeave = () => {
      visible = false
      dot.style.opacity = "0"
      ring.style.opacity = "0"
    }

    const tick = () => {
      ringX += (mouseX - ringX) * 0.18
      ringY += (mouseY - ringY) * 0.18
      ringScale += (targetScale - ringScale) * 0.16
      ring.style.transform = `translate3d(${ringX - 14}px, ${ringY - 14}px, 0) scale(${ringScale})`
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    window.addEventListener("pointermove", onMove, { passive: true })
    document.addEventListener("pointerover", onPointerOver, { passive: true })
    document.addEventListener("pointerout", onPointerOut, { passive: true })
    document.addEventListener("mouseleave", onLeave)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerover", onPointerOver)
      document.removeEventListener("pointerout", onPointerOut)
      document.removeEventListener("mouseleave", onLeave)
    }
  }, [])

  return (
    <>
      {/* Dot — pinned to real pointer */}
      <div
        ref={dotRef}
        aria-hidden="true"
        className="custom-cursor-dot pointer-events-none fixed top-0 left-0 z-[9999] h-1.5 w-1.5 rounded-full bg-foreground opacity-0 transition-opacity duration-200 will-change-transform mix-blend-difference"
      />
      {/* Ring — lag-following, inflates on interactive elements */}
      <div
        ref={ringRef}
        aria-hidden="true"
        className="custom-cursor-ring pointer-events-none fixed top-0 left-0 z-[9998] h-7 w-7 rounded-full border border-foreground/60 opacity-0 transition-[opacity,border-color] duration-200 will-change-transform mix-blend-difference data-[hover=true]:border-primary/80"
      />
    </>
  )
}

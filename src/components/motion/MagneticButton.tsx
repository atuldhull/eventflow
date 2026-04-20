"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { cn } from "@/lib/utils"

/**
 * Button-wrapper that bends toward the cursor when it's nearby — the Stripe /
 * Linear "magnetic" micro-interaction. Children are the actual visible element
 * (a <button>, an <a>, whatever) so styling stays decoupled from motion.
 *
 * `strength` (0–1) controls how far it follows. 0.4 is a good default; above
 * 0.6 gets cartoonish.
 */
interface Props {
  children: React.ReactNode
  className?: string
  strength?: number
  /** Radius in px around the element within which the cursor starts pulling it. */
  radius?: number
}

export function MagneticButton({ children, className, strength = 0.4, radius = 120 }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    if (typeof window === "undefined") return
    // Skip on coarse pointers — mobile doesn't have a cursor to attract.
    if (window.matchMedia("(pointer: coarse)").matches) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const inner = el.firstElementChild as HTMLElement | null
    if (!inner) return

    let rafId = 0
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const distance = Math.hypot(dx, dy)
      if (distance > radius) {
        targetX = 0
        targetY = 0
      } else {
        targetX = dx * strength
        targetY = dy * strength
      }
    }

    const onLeave = () => {
      targetX = 0
      targetY = 0
    }

    const tick = () => {
      // Damped follower — smooths cursor jitter.
      currentX += (targetX - currentX) * 0.15
      currentY += (targetY - currentY) * 0.15
      inner.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // Listen globally so the button starts pulling BEFORE the cursor enters it.
    window.addEventListener("mousemove", onMove, { passive: true })
    el.addEventListener("mouseleave", onLeave)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseleave", onLeave)
      gsap.set(inner, { clearProps: "transform" })
    }
  }, [strength, radius])

  return (
    <span ref={wrapRef} className={cn("inline-block", className)}>
      {children}
    </span>
  )
}

"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { cn } from "@/lib/utils"

/**
 * GSAP ScrollTrigger-driven reveal. Unlike the framer-motion `Reveal`, this is
 * tied to the smooth-scroll engine so it feels buttery — ScrollTrigger reads
 * the same scroll position Lenis is animating.
 */
interface Props {
  children: React.ReactNode
  className?: string
  /** Distance to slide from (px). */
  y?: number
  /** Initial scale for a subtle zoom-in effect. */
  scale?: number
  /** Delay in seconds. */
  delay?: number
  /** Entry duration in seconds. */
  duration?: number
  /** % of viewport height where reveal should trigger (0–100). Default 85. */
  startAt?: number
}

export function ScrollReveal({
  children, className, y = 24, scale = 1, delay = 0, duration = 0.9, startAt = 85,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    gsap.registerPlugin(ScrollTrigger)

    gsap.set(el, { opacity: 0, y, scale })
    const tween = gsap.to(el, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration,
      delay,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: `top ${startAt}%`,
        toggleActions: "play none none none",
        once: true,
      },
    })

    return () => {
      tween.kill()
      ScrollTrigger.getAll().forEach((t) => { if (t.trigger === el) t.kill() })
    }
  }, [y, scale, delay, duration, startAt])

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  )
}

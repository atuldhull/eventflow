"use client"

import { useEffect, useRef } from "react"
import Lenis from "lenis"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

/**
 * Single global Lenis instance, wired to ScrollTrigger so any GSAP scroll-
 * linked animation reads the same scroll position as the smooth-scroller.
 *
 * Skipped entirely for users who prefer reduced motion OR on coarse-pointer
 * devices with narrow viewports (mobile), where native inertial scroll is
 * already excellent and adding JS scroll hurts more than it helps.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const initialised = useRef(false)

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true

    if (typeof window === "undefined") return
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const isCoarseSmallViewport =
      window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 768
    if (prefersReduced || isCoarseSmallViewport) {
      gsap.registerPlugin(ScrollTrigger)
      return
    }

    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis({
      // Subtle, not-so-floaty; matches Apple/Linear feel.
      duration: 1.1,
      // Natural ease-out-quart.
      easing: (t) => 1 - Math.pow(1 - t, 4),
      orientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      syncTouch: false,
    })

    // Drive Lenis from GSAP's ticker so both share one RAF loop (no double work).
    const onTick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)

    // Tell ScrollTrigger to use Lenis' scroll position.
    lenis.on("scroll", ScrollTrigger.update)

    return () => {
      gsap.ticker.remove(onTick)
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}

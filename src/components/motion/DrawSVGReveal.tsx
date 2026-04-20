"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin"
import { cn } from "@/lib/utils"

/**
 * Wraps an inline <svg> and progressively "draws" every stroked path inside
 * it by animating stroke-dasharray — think of the Apple privacy-page fine-
 * line icons or the Linear logomark animating in.
 *
 * Uses GSAP's DrawSVGPlugin (free as of GSAP 3.13) which handles the maths
 * properly for curves and arbitrary path lengths — far more reliable than
 * computing getTotalLength() manually.
 */
interface Props {
  children: React.ReactNode
  /** Duration per path in seconds. */
  duration?: number
  /** Stagger between multiple paths. */
  stagger?: number
  /** Delay before the draw starts. */
  delay?: number
  /** Trigger: "mount" draws on render, "scroll" draws when scrolled into view. */
  trigger?: "mount" | "scroll"
  className?: string
}

export function DrawSVGReveal({
  children, duration = 1.1, stagger = 0.08, delay = 0, trigger = "mount", className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const host = ref.current
    if (!host) return
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    gsap.registerPlugin(DrawSVGPlugin)

    // Target every stroked path/line/circle/rect/polyline/polygon inside.
    const paths = host.querySelectorAll<SVGGeometryElement>(
      "path, line, circle, rect, polyline, polygon, ellipse"
    )
    if (paths.length === 0) return

    gsap.set(paths, { drawSVG: "0%" })

    const draw = () =>
      gsap.to(paths, {
        drawSVG: "100%",
        duration,
        stagger,
        delay,
        ease: "power3.inOut",
      })

    let tween: gsap.core.Tween | undefined
    let cleanup: (() => void) | undefined

    if (trigger === "mount") {
      tween = draw()
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              tween = draw()
              io.disconnect()
              break
            }
          }
        },
        { rootMargin: "0px 0px -10% 0px" }
      )
      io.observe(host)
      cleanup = () => io.disconnect()
    }

    return () => {
      tween?.kill()
      cleanup?.()
    }
  }, [duration, stagger, delay, trigger])

  return <span ref={ref} className={cn("inline-block", className)}>{children}</span>
}

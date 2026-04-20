"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { cn } from "@/lib/utils"

/**
 * Scroll-linked parallax. `speed = 0.5` means the child moves at half the
 * scroll speed (classic "background travels slower than foreground").
 * Negative speeds move the element against the scroll direction — useful for
 * layered hero elements floating upward as the user scrolls down.
 */
interface Props {
  children: React.ReactNode
  className?: string
  /** Speed multiplier. 0 = fixed, 1 = normal, >1 = faster-than-scroll. */
  speed?: number
}

export function Parallax({ children, className, speed = 0.5 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    gsap.registerPlugin(ScrollTrigger)

    const distance = (1 - speed) * 200  // 200px at speed=0 (fixed), 0 at speed=1
    const tween = gsap.fromTo(
      el,
      { y: -distance / 2 },
      {
        y: distance / 2,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.5,
        },
      }
    )

    return () => {
      tween.kill()
      ScrollTrigger.getAll().forEach((t) => { if (t.trigger === el) t.kill() })
    }
  }, [speed])

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  )
}

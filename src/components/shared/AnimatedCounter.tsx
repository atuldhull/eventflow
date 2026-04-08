"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
  prefix?: string
  suffix?: string
  formatFn?: (n: number) => string
}

export function AnimatedCounter({ value, duration = 1200, className, prefix, suffix, formatFn }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (hasAnimated.current) { setDisplay(value); return }

    // Only animate when visible
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true
        animate()
        observer.disconnect()
      }
    }, { threshold: 0.3 })

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()

    function animate() {
      const start = performance.now()
      const step = (now: number) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        // Ease-out with slight overshoot (spring feel)
        const eased = progress < 1
          ? 1 - Math.pow(1 - progress, 3) + (progress > 0.7 ? Math.sin((progress - 0.7) * Math.PI * 3.33) * 0.02 : 0)
          : 1
        setDisplay(Math.round(eased * value))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
  }, [value, duration])

  const formatted = formatFn ? formatFn(display) : display.toLocaleString("en-IN")

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}{formatted}{suffix}
    </span>
  )
}

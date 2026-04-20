"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { cn } from "@/lib/utils"

/**
 * Word-by-word mask reveal — each word rises from below a clip-line.
 * Hand-rolled (GSAP's paid SplitText plugin isn't needed for words).
 *
 * We only split on spaces, so punctuation stays glued to its word.
 */
interface Props {
  children: string
  /** Delay in seconds before the first word rises. */
  delay?: number
  /** Stagger between words in seconds. */
  stagger?: number
  /** CSS className applied to the outer element. */
  className?: string
  /** HTML element to render as. Default "span" (inline). */
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div"
}

export function SplitTextReveal({
  children, delay = 0, stagger = 0.05, className, as = "span",
}: Props) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.opacity = "1"
      return
    }

    const words = el.querySelectorAll<HTMLSpanElement>("[data-word]")
    if (words.length === 0) return

    // Initial state is already applied via inline styles below so there's no
    // flash of un-animated text before JS kicks in.
    const tween = gsap.to(words, {
      y: "0%",
      opacity: 1,
      duration: 0.9,
      delay,
      stagger,
      ease: "expo.out",
    })

    return () => { tween.kill() }
  }, [delay, stagger, children])

  const parts = children.split(/(\s+)/)
  const content = parts.map((part, i) => {
    if (/^\s+$/.test(part)) return <span key={i}>{part}</span>
    return (
      <span key={i} data-mask className="pb-[0.15em]">
        <span
          data-word
          style={{ transform: "translate3d(0, 115%, 0)", opacity: 0, willChange: "transform" }}
        >
          {part}
        </span>
      </span>
    )
  })
  const classes = cn(
    "inline-block [&_[data-word]]:inline-block [&_[data-mask]]:inline-block [&_[data-mask]]:overflow-hidden [&_[data-mask]]:align-bottom",
    className
  )
  const r = ref as React.Ref<HTMLElement>
  switch (as) {
    case "h1": return <h1 ref={r as React.Ref<HTMLHeadingElement>} className={classes}>{content}</h1>
    case "h2": return <h2 ref={r as React.Ref<HTMLHeadingElement>} className={classes}>{content}</h2>
    case "h3": return <h3 ref={r as React.Ref<HTMLHeadingElement>} className={classes}>{content}</h3>
    case "p":  return <p  ref={r as React.Ref<HTMLParagraphElement>} className={classes}>{content}</p>
    case "div": return <div ref={r as React.Ref<HTMLDivElement>} className={classes}>{content}</div>
    default: return <span ref={r as React.Ref<HTMLSpanElement>} className={classes}>{content}</span>
  }
}

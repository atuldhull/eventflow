"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"
import { cn } from "@/lib/utils"

/**
 * Real GSAP SplitText-driven reveal — splits by lines + words so long
 * headlines wrap naturally and animate per line with a mask, while single-
 * line text animates word-by-word. Characters mode available for short hero
 * phrases where each letter rising individually is the whole point.
 *
 * SplitText ships free in the `gsap` npm package as of 3.13, so we don't need
 * the hand-rolled substitute anymore.
 */
interface Props {
  children: string
  /** What to split. "words+lines" is the default — best for most copy. */
  mode?: "words" | "chars" | "words+lines"
  delay?: number
  stagger?: number
  duration?: number
  className?: string
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div"
}

export function SplitTextReveal({
  children,
  mode = "words+lines",
  delay = 0,
  stagger = 0.05,
  duration = 0.9,
  className,
  as = "span",
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

    gsap.registerPlugin(SplitText)

    // `mask: "lines"` creates an overflow-hidden wrapper per line so words
    // appear to rise from *below the line*, not below the whole element —
    // this is the detail that makes editorial type feel premium.
    const types =
      mode === "chars" ? "chars" :
      mode === "words" ? "words" :
      "lines,words"

    const split = new SplitText(el, {
      type: types,
      mask: mode === "words+lines" ? "lines" : undefined,
      linesClass: "split-line",
      wordsClass: "split-word",
      charsClass: "split-char",
    })

    const targets =
      mode === "chars" ? split.chars :
      mode === "words" ? split.words :
      split.words ?? split.lines

    gsap.set(targets, { yPercent: 115, opacity: 0 })
    const tween = gsap.to(targets, {
      yPercent: 0,
      opacity: 1,
      duration,
      delay,
      stagger: mode === "chars" ? stagger * 0.4 : stagger,
      ease: "expo.out",
    })

    return () => {
      tween.kill()
      split.revert()
    }
  }, [mode, delay, stagger, duration, children])

  const classes = cn("inline-block", className)
  const r = ref as React.Ref<HTMLElement>
  switch (as) {
    case "h1": return <h1 ref={r as React.Ref<HTMLHeadingElement>} className={classes}>{children}</h1>
    case "h2": return <h2 ref={r as React.Ref<HTMLHeadingElement>} className={classes}>{children}</h2>
    case "h3": return <h3 ref={r as React.Ref<HTMLHeadingElement>} className={classes}>{children}</h3>
    case "p":  return <p  ref={r as React.Ref<HTMLParagraphElement>} className={classes}>{children}</p>
    case "div": return <div ref={r as React.Ref<HTMLDivElement>} className={classes}>{children}</div>
    default: return <span ref={r as React.Ref<HTMLSpanElement>} className={classes}>{children}</span>
  }
}

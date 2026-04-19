"use client"

import * as React from "react"
import { motion, useReducedMotion, useInView, type Variants, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

// ─── Shared easing / durations ──────────────────────────────────────────────
// Snappy but not jittery. These match the tokens in tailwind's ease-out-quart.
const EASE_OUT = [0.22, 1, 0.36, 1] as const
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

const DUR = {
  fast: 0.2,
  base: 0.35,
  slow: 0.5,
} as const

// ─── PageTransition ─────────────────────────────────────────────────────────
// Fade + subtle lift for page-mount. Drop this around the top-level content
// of a route to give it a gentle entrance. Respects prefers-reduced-motion.

interface PageTransitionProps extends React.ComponentProps<"div"> {
  delay?: number
}

export function PageTransition({ children, delay = 0, className, ...rest }: PageTransitionProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.base, ease: EASE_OUT, delay }}
      className={className}
      {...(rest as HTMLMotionProps<"div">)}
    >
      {children}
    </motion.div>
  )
}

// ─── Reveal ─────────────────────────────────────────────────────────────────
// Reveals its children when it scrolls into view. Fires once. Good for below-
// the-fold sections on marketing pages.

interface RevealProps extends React.ComponentProps<"div"> {
  delay?: number
  distance?: number
}

export function Reveal({ children, delay = 0, distance = 16, className, ...rest }: RevealProps) {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "0px 0px -80px 0px" })

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: distance }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: DUR.base, ease: EASE_OUT, delay }}
      className={className}
      {...(rest as HTMLMotionProps<"div">)}
    >
      {children}
    </motion.div>
  )
}

// ─── Stagger ────────────────────────────────────────────────────────────────
// Parent that staggers its direct children's fade+slide-in. Pair with
// <StaggerItem> or plain motion children using `variants={staggerItem}`.

const parentVariants: Variants = {
  hidden: { opacity: 1 },  // Parent stays visible; children fade in
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
}

interface StaggerProps extends React.ComponentProps<"div"> {
  /** Use "scroll" to trigger on viewport enter (once), "mount" to trigger immediately. */
  trigger?: "scroll" | "mount"
}

export function Stagger({ children, trigger = "mount", className, ...rest }: StaggerProps) {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" })

  if (reduced) return <div className={className} {...rest}>{children}</div>

  const animate = trigger === "scroll" ? (inView ? "show" : "hidden") : "show"
  return (
    <motion.div
      ref={ref}
      variants={parentVariants}
      initial="hidden"
      animate={animate}
      className={className}
      {...(rest as HTMLMotionProps<"div">)}
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps extends React.ComponentProps<"div"> {}

export function StaggerItem({ children, className, ...rest }: StaggerItemProps) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className} {...rest}>{children}</div>
  return (
    <motion.div variants={staggerItem} className={className} {...(rest as HTMLMotionProps<"div">)}>
      {children}
    </motion.div>
  )
}

// ─── AnimatedNumber ─────────────────────────────────────────────────────────
// Tweens a number from 0 (or `from`) to `value` over a short duration.
// Honours reduced-motion (shows final value immediately).

interface AnimatedNumberProps {
  value: number
  from?: number
  duration?: number
  format?: (n: number) => string
  className?: string
  /** Prefix/suffix (e.g. currency symbol) appended without interfering with the count. */
  prefix?: string
  suffix?: string
}

export function AnimatedNumber({
  value, from = 0, duration = 0.9, format, prefix, suffix, className,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = React.useState(reduced ? value : from)

  React.useEffect(() => {
    if (reduced) { setDisplay(value); return }
    const start = performance.now()
    const delta = value - from
    let rafId = 0
    const step = (now: number) => {
      const elapsed = (now - start) / 1000
      const t = Math.min(1, elapsed / duration)
      // ease-out-quart
      const eased = 1 - Math.pow(1 - t, 4)
      const current = from + delta * eased
      setDisplay(current)
      if (t < 1) rafId = requestAnimationFrame(step)
      else setDisplay(value)
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [value, from, duration, reduced])

  const rounded = Number.isInteger(value) ? Math.round(display) : display
  const formatted = format ? format(rounded) : rounded.toLocaleString("en-IN")
  return (
    <span className={className}>
      {prefix}{formatted}{suffix}
    </span>
  )
}

// ─── FadeInScale ────────────────────────────────────────────────────────────
// A small scale-from-0.9 entrance — good for icons in empty states and hero
// elements that should feel like they "pop in".

interface FadeInScaleProps extends React.ComponentProps<"div"> {
  delay?: number
}

export function FadeInScale({ children, delay = 0, className, ...rest }: FadeInScaleProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: DUR.base, ease: EASE_OUT_EXPO, delay }}
      className={className}
      {...(rest as HTMLMotionProps<"div">)}
    >
      {children}
    </motion.div>
  )
}

// ─── HoverLift ──────────────────────────────────────────────────────────────
// Small micro-interaction — children scale up 1.02 on hover. Uses CSS so it
// works without motion JS, just grouped into the motion module for discovery.

export function hoverLiftClass(extra = "") {
  return cn(
    "transition-transform duration-200 will-change-transform",
    "hover:-translate-y-0.5 hover:shadow-lg",
    extra
  )
}

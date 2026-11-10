"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * The lemon highlighter stroke behind one phrase of a headline, slightly rotated.
 * It swipes in from the left the first time it is seen (instant with reduced motion).
 */
export function Highlighter({
  children,
  delay = 0.5,
  className,
  tone = "lemon",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  tone?: "lemon" | "lavender" | "ink"
}) {
  return (
    <span
      className={cn(
        "relative z-0 inline-block px-[0.06em]",
        tone === "ink" ? "text-lemon" : "text-lemon-ink",
        className,
      )}
    >
      <motion.span
        aria-hidden
        className={cn(
          "absolute -inset-x-[0.04em] top-[0.06em] bottom-[0.02em] -z-10 origin-left -rotate-[1.5deg] rounded-[0.16em]",
          tone === "lemon" && "bg-lemon",
          tone === "lavender" && "bg-lavender",
          tone === "ink" && "bg-charcoal",
        )}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay, ease: EASE }}
      />
      {children}
    </span>
  )
}

/** A small label over a headline: a lemon dash and a word in the brand colour. */
export function Kicker({ children, className, onDark = false }: { children: React.ReactNode; className?: string; onDark?: boolean }) {
  return (
    <p className={cn("flex items-center gap-2 text-sm font-semibold", onDark ? "text-lemon" : "text-brand", className)}>
      <span className={cn("h-[2px] w-6 rounded-full", onDark ? "bg-lavender" : "bg-lemon")} aria-hidden />
      {children}
    </p>
  )
}

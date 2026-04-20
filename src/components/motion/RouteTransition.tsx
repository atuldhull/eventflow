"use client"

import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

/**
 * Fades/slides between routes using framer-motion's `AnimatePresence`, keyed
 * on `usePathname()`. Works with Next 16's App Router — the pathname hook
 * returns a stable string for each route, so `key` changes on navigation and
 * AnimatePresence fires an exit-then-enter cycle.
 *
 * Kept deliberately subtle (12px lift, 240ms) — a page transition people
 * notice is a page transition that gets in the way. We're signalling "the
 * page changed," not performing a choreography.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reduced = useReducedMotion()

  if (reduced) return <>{children}</>

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

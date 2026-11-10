"use client"

import { usePathname } from "next/navigation"
import { MotionConfig, motion } from "framer-motion"

/**
 * Signals "the page changed" without slowing navigation: the new page fades
 * in over 180ms with a 4px rise. There is no exit animation, so a click is
 * never held back waiting for the old page to leave.
 * The element tree is the same on the server and the client (no branch on the
 * reduced-motion media query, which the server can't know), so hydration
 * always matches; MotionConfig drops the movement for reduced-motion users.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  )
}

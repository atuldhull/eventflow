"use client"

import { useRef } from "react"
import { motion, useInView, type Variants } from "framer-motion"

// ============================================================
// FADE IN — gentle opacity + y movement
// ============================================================
export function FadeIn({ children, className, delay = 0, direction = "up" }: {
  children: React.ReactNode; className?: string; delay?: number; direction?: "up" | "down" | "left" | "right"
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-60px" })
  const dirMap = { up: { y: 24 }, down: { y: -24 }, left: { x: 24 }, right: { x: -24 } }
  return (
    <motion.div ref={ref} initial={{ opacity: 0, ...dirMap[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.4, 0.25, 1] }} className={className}>
      {children}
    </motion.div>
  )
}

// ============================================================
// STAGGER CHILDREN — parent that staggers child animations
// ============================================================
const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] } },
}

export function StaggerContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-40px" })
  return (
    <motion.div ref={ref} variants={staggerContainer} initial="hidden" animate={isInView ? "show" : "hidden"} className={className}>
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={staggerItem} className={className}>{children}</motion.div>
}

// ============================================================
// SCALE ON HOVER — card/button hover effect
// ============================================================
export function ScaleOnHover({ children, className, scale = 1.02 }: {
  children: React.ReactNode; className?: string; scale?: number
}) {
  return (
    <motion.div whileHover={{ scale }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 17 }} className={className}>
      {children}
    </motion.div>
  )
}

// ============================================================
// SLIDE IN — slides from a direction with spring physics
// ============================================================
export function SlideIn({ children, className, from = "left", delay = 0 }: {
  children: React.ReactNode; className?: string; from?: "left" | "right" | "top" | "bottom"; delay?: number
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-40px" })
  const initial = {
    left: { x: -60, opacity: 0 }, right: { x: 60, opacity: 0 },
    top: { y: -40, opacity: 0 }, bottom: { y: 40, opacity: 0 },
  }
  return (
    <motion.div ref={ref} initial={initial[from]}
      animate={isInView ? { x: 0, y: 0, opacity: 1 } : {}}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay }} className={className}>
      {children}
    </motion.div>
  )
}

// ============================================================
// PULSE — attention-drawing pulse effect
// ============================================================
export function Pulse({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className={className}>
      {children}
    </motion.div>
  )
}

// ============================================================
// NUMBER COUNTER — animates from 0 to target
// ============================================================
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  return (
    <motion.span ref={ref} className={className}
      initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}}>
      {isInView ? (
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          {value.toLocaleString("en-IN")}
        </motion.span>
      ) : "0"}
    </motion.span>
  )
}

// ============================================================
// PAGE TRANSITION — wrapper for page-level enter animation
// ============================================================
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  )
}

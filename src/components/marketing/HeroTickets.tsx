"use client"

import { MotionConfig, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { SampleTicket, type SampleTicketData } from "./SampleTicket"

const SAMPLES: SampleTicketData[] = [
  { month: "Nov", day: 13, weekday: "Fri", title: "Winter Hackathon 2026", venue: "Main auditorium", status: "confirmed", ticketType: "General", code: "TKT-8F3K2" },
  { month: "Nov", day: 6, weekday: "Fri", title: "Design Sprint: Campus App", venue: "Studio B", status: "checked_in", ticketType: "Student", code: "TKT-2M9QA" },
  { month: "Nov", day: 20, weekday: "Fri", title: "Classical Night", venue: "Open-air theatre", status: "confirmed", ticketType: "VIP", code: "TKT-7XC4D" },
]

/** each ticket sits a little off the column, like passes dropped on a desk */
const OFFSET = ["sm:ml-0", "sm:ml-7", "sm:ml-3"]
const TILT = [-2, 1.5, -1]

/**
 * The landing page's one orchestrated moment: three sample tickets settle into
 * place on load (transform and opacity only). Reduced-motion users get a fade.
 * Purely illustrative, so it is hidden from assistive technology.
 */
export function HeroTickets({ className }: { className?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <div aria-hidden className={cn("rounded-2xl bg-frame px-5 py-8 sm:p-10 dark:border dark:border-border", className)}>
        <div className="mx-auto flex max-w-[540px] flex-col gap-3">
          {SAMPLES.map((ticket, i) => (
            <motion.div
              key={ticket.code}
              initial={{ opacity: 0, y: 28, rotate: TILT[i] }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.75, delay: 0.12 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className={cn("sm:w-[calc(100%-28px)]", OFFSET[i], i === 2 && "max-sm:hidden")}
            >
              <SampleTicket ticket={ticket} />
            </motion.div>
          ))}
        </div>
      </div>
    </MotionConfig>
  )
}

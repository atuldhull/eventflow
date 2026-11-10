"use client"

import { MotionConfig, motion } from "framer-motion"
import { CheckCircle2, WifiOff } from "lucide-react"
import { Marquee, Tilt } from "@/components/marketing/fx"
import { SampleTicket, type SampleTicketData } from "@/components/marketing/SampleTicket"

const EASE = [0.22, 1, 0.36, 1] as const

const FRONT: SampleTicketData = {
  month: "Nov", day: 13, weekday: "Fri", title: "Winter Hackathon 2026", venue: "Main auditorium", status: "confirmed", ticketType: "General", code: "TKT-8F3K2",
}
const BACK: SampleTicketData = {
  month: "Nov", day: 20, weekday: "Fri", title: "Classical Night", venue: "Open-air theatre", status: "checked_in", ticketType: "VIP", code: "TKT-7XC4D",
}

/** What the product does, as it says on the landing page. */
const THINGS = ["Registration", "Payments", "Tickets on your phone", "QR check-in", "Certificates", "Analytics", "Team registration", "Coupons", "Refunds"]

/**
 * The wide-screen half of the auth frame: a charcoal field with drifting lavender and
 * lemon light, a sample ticket that tilts toward the pointer, and a rotated marquee band.
 * Decorative only, so it is hidden from assistive technology by the layout.
 */
export function BrandPanel() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative isolate flex h-full flex-col overflow-hidden rounded-[28px] bg-charcoal text-white ring-1 ring-white/10">
        <div className="fx-aurora pointer-events-none absolute inset-0 -z-10">
          <span className="top-[-12%] right-[-10%] size-[460px] bg-lavender/40" />
          <span className="bottom-[10%] left-[-15%] size-[380px] bg-lemon/12" />
          <span className="top-[35%] left-[30%] size-[420px] bg-[#6d28d9]/30" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_60%_45%,#000_25%,transparent_80%)]"
        />

        {/* the line */}
        <div className="px-10 pt-10 xl:px-14 xl:pt-14">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1.5 pr-3.5 pl-2 text-[13px] font-medium text-white/85"
          >
            <span className="relative flex size-2.5">
              <span className="fx-ping absolute inline-flex size-full rounded-full bg-lavender" />
              <span className="relative inline-flex size-2.5 rounded-full bg-lavender" />
            </span>
            For college and company events
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
            className="font-display mt-6 text-[44px] leading-[1.06] font-extrabold tracking-[-0.045em] xl:text-[60px] 2xl:text-[68px]"
          >
            Find it. Register.
            <br />
            <span className="relative z-0 inline-block px-[0.06em] text-lemon-ink">
              <motion.span
                className="absolute -inset-x-[0.04em] top-[0.06em] bottom-[0.02em] -z-10 origin-left -rotate-[1.5deg] rounded-[0.16em] bg-lemon"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
              />
              Walk right in.
            </span>
          </motion.p>
        </div>

        {/* the artefact: two tickets, the front one tilting toward the pointer */}
        <div className="relative flex flex-1 items-center justify-center px-10 py-8 xl:px-14">
          <div className="relative w-full max-w-[460px]">
            <div className="absolute inset-[10%] -z-10 rounded-full bg-lavender/45 blur-[80px]" />
            <motion.div
              initial={{ opacity: 0, y: 40, rotate: 10 }}
              animate={{ opacity: 0.55, y: 0, rotate: 5 }}
              transition={{ duration: 1, delay: 0.25, ease: EASE }}
              className="absolute inset-x-6 left-16 -top-16 xl:-top-20"
            >
              <SampleTicket ticket={BACK} notchClassName="bg-charcoal" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 60, rotate: -8 }}
              animate={{ opacity: 1, y: 0, rotate: -2.5 }}
              transition={{ duration: 1.1, delay: 0.35, ease: EASE }}
            >
              <Tilt max={7}>
                <div className="fx-float drop-shadow-[0_28px_44px_rgb(0_0_0/0.5)]">
                  <SampleTicket ticket={FRONT} notchClassName="bg-charcoal" />
                </div>
              </Tilt>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.1, type: "spring", bounce: 0.5 }}
              className="absolute -right-3 -bottom-9 xl:-right-8"
            >
              <div className="fx-float flex items-center gap-2 rounded-full bg-lemon px-4 py-2 text-[13px] font-semibold text-lemon-ink shadow-xl" style={{ animationDelay: "-2s" }}>
                <CheckCircle2 className="size-4" /> Scanned at the door
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.3, type: "spring", bounce: 0.5 }}
              className="absolute -bottom-20 left-2 xl:-left-4"
            >
              <div className="fx-float flex items-center gap-2 rounded-full bg-lavender px-4 py-2 text-[13px] font-semibold text-charcoal shadow-xl" style={{ animationDelay: "-4s" }}>
                <WifiOff className="size-4" /> Opens offline
              </div>
            </motion.div>
          </div>
        </div>

        {/* the band */}
        <div className="-mx-4 mt-6 -rotate-2 bg-lemon py-3 text-lemon-ink">
          <Marquee speed={40}>
            {THINGS.map((w) => (
              <span key={w} className="font-display flex items-center gap-6 px-3 text-[22px] font-extrabold tracking-[-0.03em]">
                {w}
                <span className="size-2 rounded-full bg-charcoal" />
              </span>
            ))}
          </Marquee>
        </div>

        <p className="max-w-[52ch] px-10 pt-8 pb-10 text-[15px] leading-relaxed text-white/70 xl:px-14 xl:pb-12">
          EventFlow runs events for colleges and companies: registration and payments, a ticket on your phone, QR check-in at the door and
          certificates afterwards.
        </p>
      </div>
    </MotionConfig>
  )
}

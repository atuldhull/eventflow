"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { cn } from "@/lib/utils"
import { fmtShort, fmtTime, inr, type EventData } from "./types"

interface Props {
  event: EventData
  canRegister: boolean
  lowestPrice: number
  /** id of the register card's action; the bar shows while that is off screen */
  watchId: string
}

/**
 * Phones only: a bottom bar that keeps Register (or View my ticket) in reach
 * once the register card has scrolled away. It steps aside at the footer.
 */
export function EventStickyBar({ event, canRegister, lowestPrice, watchId }: Props) {
  const isRegistered = !!event.myRegistration && event.myRegistration.status !== "CANCELLED"
  const [ctaVisible, setCtaVisible] = useState(true)
  const [footerVisible, setFooterVisible] = useState(false)

  useEffect(() => {
    const cta = document.getElementById(watchId)
    const footer = document.querySelector("footer")
    const observers: IntersectionObserver[] = []
    if (cta) {
      const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting))
      io.observe(cta)
      observers.push(io)
    }
    if (footer) {
      const io = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting))
      io.observe(footer)
      observers.push(io)
    }
    return () => observers.forEach((io) => io.disconnect())
  }, [watchId])

  if (!isRegistered && !canRegister) return null
  const show = !ctaVisible && !footerVisible

  return (
    <div
      // lifts toasts above the bar (globals.css :root:has([data-bottombar]))
      data-bottombar=""
      inert={!show}
      aria-hidden={!show}
      className={cn(
        "pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-md transition-transform duration-200 ease-out lg:hidden",
        show ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-5 py-3 sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-muted-foreground tabular-nums">
            {fmtShort(event.startDate, event.timezone)} · {fmtTime(event.startDate, event.timezone)}
          </p>
          {isRegistered ? (
            <Pill tone="positive" dot className="mt-1">Registered</Pill>
          ) : (
            <p className="font-display text-[19px] leading-tight font-extrabold tracking-[-0.03em] tabular-nums">{event.isPaid ? `From ${lowestPrice === 0 ? "Free" : inr(lowestPrice)}` : "Free"}</p>
          )}
        </div>
        {isRegistered ? (
          <Link href="/dashboard/tickets" className={cn(buttonVariants({ variant: "outline" }), "h-12 shrink-0 px-5")}>
            View my ticket
          </Link>
        ) : (
          <Link
            href={`/events/${event.slug}/register`}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-lemon px-7 text-[15px] font-semibold text-lemon-ink outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            Register
          </Link>
        )}
      </div>
    </div>
  )
}

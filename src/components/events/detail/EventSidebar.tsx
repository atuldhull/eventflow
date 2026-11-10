"use client"

import Link from "next/link"
import { CalendarClock, Share2, Timer, UserCheck, Users, ListOrdered } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Pill, type Tone } from "@/components/ui/pill"
import { cn } from "@/lib/utils"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { CountdownTimer } from "@/components/events/CountdownTimer"
import { ShareModal } from "@/components/events/ShareModal"
import { SaveEventButton } from "@/components/events/SaveEventButton"
import { formatInZone } from "@/lib/event-time"
import { inr, type EventData } from "./types"

interface Props {
  event: EventData
  eventUrl: string
  canRegister: boolean
  isCancelled: boolean
  isSoldOut: boolean
  registrationNotOpenYet: boolean
  spotsLeft: number | null
  lowestPrice: number
  /** id on the main action, so the phone bar can tell when it scrolls away */
  ctaId?: string
}

const REG_STATUS: Record<string, { label: string; tone: Tone }> = {
  CONFIRMED: { label: "You're registered", tone: "positive" },
  CHECKED_IN: { label: "Checked in", tone: "positive" },
  PENDING: { label: "Pending payment / approval", tone: "warning" },
  WAITLISTED: { label: "On the waitlist", tone: "warning" },
}

const fmtCloses = (d: string, tz?: string | null) =>
  formatInZone(d, tz, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

/**
 * The register card: price, ticket types, the one primary action, seats taken,
 * and Save / Share. Sticky beside the content on desktop; on phones it sits
 * under the title and a bottom bar takes over once it scrolls away.
 */
export function EventSidebar({ event, eventUrl, canRegister, isCancelled, isSoldOut, registrationNotOpenYet, spotsLeft, lowestPrice, ctaId }: Props) {
  const myReg = event.myRegistration
  const isRegistered = !!myReg && myReg.status !== "CANCELLED"
  const regStatus = myReg ? REG_STATUS[myReg.status] ?? { label: statusLabel(myReg.status), tone: statusTone(myReg.status) } : null
  const showCountdown = canRegister && new Date(event.startDate) > new Date()
  const taken = event.maxCapacity ? Math.min((event.currentRegistrations / event.maxCapacity) * 100, 100) : 0
  const ctaClass = "h-11 w-full text-[15px] pointer-coarse:h-12"

  return (
    <div className="lg:sticky lg:top-[88px]">
      <section aria-labelledby="register-card-heading" className="rounded-lg border bg-card p-5 sm:p-6">
        <h2 id="register-card-heading" className="sr-only">Tickets and registration</h2>

        {/* Price headline */}
        {event.ticketTypes.length > 0 ? (
          event.isPaid ? (
            <div>
              <p className="text-[13px] text-muted-foreground">From</p>
              <p className="mt-0.5 text-[28px] leading-8 font-semibold tracking-[-0.02em] tabular-nums">
                {lowestPrice === 0 ? "Free" : inr(lowestPrice)}
              </p>
            </div>
          ) : (
            <p className="text-[28px] leading-8 font-semibold tracking-[-0.02em]">Free</p>
          )
        ) : (
          <p className="text-[22px] leading-7 font-semibold tracking-[-0.015em]">{event.isPaid ? "Paid event" : "Free event"}</p>
        )}

        {/* Ticket types */}
        {event.ticketTypes.length > 0 && (
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {event.ticketTypes.map((tt) => {
              const remaining = tt.quantity ? tt.quantity - tt.sold : null
              const soldOut = remaining !== null && remaining <= 0
              return (
                <li key={tt.id} className={cn("flex items-start justify-between gap-4 py-3", soldOut && "text-muted-foreground")}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tt.name}</p>
                    {tt.description && <p className="mt-0.5 text-[13px] text-muted-foreground">{tt.description}</p>}
                    {remaining !== null && remaining > 0 && (
                      <p className={cn("mt-0.5 text-[13px] tabular-nums", remaining <= 5 ? "text-destructive" : "text-muted-foreground")}>
                        {remaining} left
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-sm font-semibold tabular-nums">{tt.price === 0 ? "Free" : inr(tt.price)}</p>
                    {soldOut && <Pill tone="neutral">Sold out</Pill>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Your registration */}
        {isRegistered && regStatus && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-raised px-3 py-2.5">
            <Pill tone={regStatus.tone} dot>{regStatus.label}</Pill>
            <span className="truncate font-mono text-xs text-muted-foreground">#{myReg!.registrationNumber}</span>
          </div>
        )}

        {/* The one action */}
        <div id={ctaId} className="mt-4">
          {isRegistered ? (
            <Link href="/dashboard/tickets" className={cn(buttonVariants(), ctaClass)}>
              View my ticket
            </Link>
          ) : canRegister ? (
            <Link href={`/events/${event.slug}/register`} className={cn(buttonVariants(), ctaClass)}>
              {event.isPaid ? "Register" : "Register for free"}
            </Link>
          ) : isCancelled ? (
            <Button disabled variant="secondary" className={ctaClass}>Event cancelled</Button>
          ) : isSoldOut ? (
            <Button disabled variant="secondary" className={ctaClass}>Sold out</Button>
          ) : registrationNotOpenYet ? (
            <div className="space-y-2 text-center">
              <Button disabled variant="secondary" className={ctaClass}>Registration not open</Button>
              <p className="text-[13px] text-muted-foreground">
                Opens on {formatInZone(event.registrationStartDate!, event.timezone, { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          ) : event.status === "COMPLETED" ? (
            <Button disabled variant="secondary" className={ctaClass}>Event ended</Button>
          ) : (
            <Button disabled variant="secondary" className={ctaClass}>Registration closed</Button>
          )}
        </div>

        {/* Seats */}
        {event.maxCapacity ? (
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground tabular-nums">
              <span>
                <span className="font-medium text-foreground">{event.currentRegistrations.toLocaleString("en-IN")}</span> registered
              </span>
              <span>{Math.max(0, spotsLeft ?? 0).toLocaleString("en-IN")} spots left</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Seats taken"
              aria-valuemin={0}
              aria-valuemax={event.maxCapacity}
              aria-valuenow={Math.min(event.currentRegistrations, event.maxCapacity)}
            >
              <div className="h-full rounded-full bg-brand" style={{ width: `${taken}%` }} />
            </div>
          </div>
        ) : event.currentRegistrations > 0 && event.visibility === "PUBLIC" ? (
          <p className="mt-5 text-[13px] text-muted-foreground tabular-nums">
            <span className="font-medium text-foreground">{event.currentRegistrations.toLocaleString("en-IN")}</span>{" "}
            {event.currentRegistrations === 1 ? "person" : "people"} registered
          </p>
        ) : null}

        {/* Small print */}
        {(showCountdown || event.registrationEndDate || event.approvalRequired || event.allowTeamRegistration || (event.waitlistEnabled && spotsLeft !== null && spotsLeft <= 0)) && (
          <ul className="mt-4 space-y-2 text-[13px] text-muted-foreground">
            {showCountdown && (
              <li className="flex items-start gap-2">
                <Timer className="mt-px size-3.5 shrink-0" aria-hidden />
                <CountdownTimer targetDate={event.startDate} />
              </li>
            )}
            {event.registrationEndDate && (
              <li className="flex items-start gap-2">
                <CalendarClock className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>Registration closes <span className="tabular-nums">{fmtCloses(event.registrationEndDate, event.timezone)}</span></span>
              </li>
            )}
            {event.approvalRequired && (
              <li className="flex items-start gap-2">
                <UserCheck className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>Registration requires approval</span>
              </li>
            )}
            {event.waitlistEnabled && spotsLeft !== null && spotsLeft <= 0 && (
              <li className="flex items-start gap-2">
                <ListOrdered className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>Waitlist available</span>
              </li>
            )}
            {event.allowTeamRegistration && (
              <li className="flex items-start gap-2">
                <Users className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>Team registration &middot; {event.minTeamSize}&ndash;{event.maxTeamSize} members</span>
              </li>
            )}
          </ul>
        )}

        {/* Save + Share */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <SaveEventButton eventId={event.id} variant="button" />
          <ShareModal
            url={eventUrl}
            title={event.title}
            description={event.shortDescription}
            trigger={<Button variant="outline" className="w-full gap-2"><Share2 className="size-4" /> Share</Button>}
          />
        </div>
      </section>
    </div>
  )
}

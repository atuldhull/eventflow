"use client"

import Link from "next/link"
import { ArrowRight, CalendarClock, Share2, Timer, UserCheck, Users, ListOrdered } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Pill, type Tone } from "@/components/ui/pill"
import { cn } from "@/lib/utils"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { CountdownTimer } from "@/components/events/CountdownTimer"
import { ShareModal } from "@/components/events/ShareModal"
import { SaveEventButton } from "@/components/events/SaveEventButton"
import { Perforation } from "@/components/events/poster"
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
  const ctaClass = "h-12 w-full rounded-full text-[15px]"
  // the register action: lemon in both themes, like the landing page's calls to action
  const ctaLemon =
    "group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lemon px-6 text-[16px] font-semibold text-lemon-ink outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_var(--lemon)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:translate-y-0 active:scale-[0.98]"

  return (
    <div className="lg:sticky lg:top-[88px]">
      <section
        aria-labelledby="register-card-heading"
        className="overflow-hidden rounded-[26px] border bg-card shadow-[0_30px_60px_-34px_rgb(0_0_0/0.45)]"
      >
        <h2 id="register-card-heading" className="sr-only">Tickets and registration</h2>

        {/* Price headline, on the stub's lavender band */}
        <div className="relative overflow-hidden bg-lavender px-6 pt-5 pb-6 text-charcoal">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-10 size-36 rounded-full opacity-25"
            style={{ backgroundImage: "repeating-radial-gradient(circle, #171717 0 1.5px, transparent 1.5px 12px)" }}
          />
          <p className="text-[12px] font-bold tracking-[0.18em] uppercase">Admit one</p>
          {event.ticketTypes.length > 0 ? (
            event.isPaid ? (
              <div className="mt-2">
                <p className="text-[14px] font-semibold">From</p>
                <p className="font-display text-[52px] leading-[0.95] font-extrabold tracking-[-0.05em] tabular-nums">
                  {lowestPrice === 0 ? "Free" : inr(lowestPrice)}
                </p>
              </div>
            ) : (
              <p className="font-display mt-2 text-[52px] leading-[0.95] font-extrabold tracking-[-0.05em]">Free</p>
            )
          ) : (
            <p className="font-display mt-2 text-[34px] leading-none font-extrabold tracking-[-0.04em]">{event.isPaid ? "Paid event" : "Free event"}</p>
          )}
        </div>

        <div className="px-6 pt-2 pb-6">
          {/* Ticket types */}
          {event.ticketTypes.length > 0 && (
            <ul className="divide-y divide-dashed divide-border">
              {event.ticketTypes.map((tt) => {
                const remaining = tt.quantity ? tt.quantity - tt.sold : null
                const soldOut = remaining !== null && remaining <= 0
                return (
                  <li key={tt.id} className={cn("flex items-start justify-between gap-4 py-3.5", soldOut && "text-muted-foreground")}>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{tt.name}</p>
                      {tt.description && <p className="mt-0.5 text-[13px] text-muted-foreground">{tt.description}</p>}
                      {remaining !== null && remaining > 0 && (
                        <p className={cn("mt-0.5 text-[13px] tabular-nums", remaining <= 5 ? "text-destructive" : "text-muted-foreground")}>
                          {remaining} left
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="font-display text-[20px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">{tt.price === 0 ? "Free" : inr(tt.price)}</p>
                      {soldOut && <Pill tone="neutral">Sold out</Pill>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Your registration */}
          {isRegistered && regStatus && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-raised px-3.5 py-3">
              <Pill tone={regStatus.tone} dot>{regStatus.label}</Pill>
              <span className="truncate font-mono text-xs text-muted-foreground">#{myReg!.registrationNumber}</span>
            </div>
          )}
        </div>

        <Perforation notchClassName="bg-background" />

        <div className="px-6 pt-6 pb-6">
          {/* The one action */}
          <div id={ctaId}>
            {isRegistered ? (
              <Link href="/dashboard/tickets" className={ctaLemon}>
                View my ticket
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </Link>
            ) : canRegister ? (
              <Link href={`/events/${event.slug}/register`} className={ctaLemon}>
                {event.isPaid ? "Register" : "Register for free"}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </Link>
            ) : isCancelled ? (
              <Button disabled variant="secondary" className={ctaClass}>Event cancelled</Button>
            ) : isSoldOut ? (
              <Button disabled variant="secondary" className={ctaClass}>Sold out</Button>
            ) : registrationNotOpenYet ? (
              <div className="space-y-2.5 text-center">
                <Button disabled variant="secondary" className={ctaClass}>Registration not open</Button>
                <p className="text-[14px] text-muted-foreground">
                  Opens on{" "}
                  <span className="font-semibold text-foreground">
                    {formatInZone(event.registrationStartDate!, event.timezone, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
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
            <div className="mt-6">
              <div className="flex items-end justify-between gap-3 text-[13px] text-muted-foreground tabular-nums">
                <span>
                  <span className="font-display block text-[26px] leading-none font-extrabold tracking-[-0.04em] text-foreground">
                    {event.currentRegistrations.toLocaleString("en-IN")}
                  </span>
                  registered
                </span>
                <span className="text-right">
                  <span className="font-display block text-[26px] leading-none font-extrabold tracking-[-0.04em] text-brand">
                    {Math.max(0, spotsLeft ?? 0).toLocaleString("en-IN")}
                  </span>
                  spots left
                </span>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Seats taken"
                aria-valuemin={0}
                aria-valuemax={event.maxCapacity}
                aria-valuenow={Math.min(event.currentRegistrations, event.maxCapacity)}
              >
                <div className="h-full min-w-2 rounded-full bg-brand" style={{ width: `${taken}%` }} />
              </div>
            </div>
          ) : event.currentRegistrations > 0 && event.visibility === "PUBLIC" ? (
            <p className="mt-6 text-[14px] text-muted-foreground tabular-nums">
              <span className="font-display text-[22px] font-extrabold tracking-[-0.03em] text-foreground">{event.currentRegistrations.toLocaleString("en-IN")}</span>{" "}
              {event.currentRegistrations === 1 ? "person" : "people"} registered
            </p>
          ) : null}

          {/* Small print */}
          {(showCountdown || event.registrationEndDate || event.approvalRequired || event.allowTeamRegistration || (event.waitlistEnabled && spotsLeft !== null && spotsLeft <= 0)) && (
            <ul className="mt-5 space-y-2 border-t border-rule pt-4 text-[13px] text-muted-foreground">
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
            <SaveEventButton eventId={event.id} variant="button" className="h-11" />
            <ShareModal
              url={eventUrl}
              title={event.title}
              description={event.shortDescription}
              trigger={<Button variant="outline" className="h-11 w-full gap-2"><Share2 className="size-4" /> Share</Button>}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

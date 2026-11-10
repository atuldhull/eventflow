"use client"

import { Calendar, MapPin, Monitor } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { PosterPattern, posterTheme } from "@/components/events/poster"
import { statusLabel } from "@/lib/status-tone"
import { formatInZone } from "@/lib/event-time"
import { useEventZoneNote } from "@/hooks/useViewerTimeZone"
import { cn } from "@/lib/utils"
import { eventStatus, fmtDay, fmtShort, fmtTime, type EventData } from "./types"

/**
 * The event's own poster across the top of the page: the cover photo, large, with a lemon
 * date stamp; or, without a photo, a poster field in the event's brand colour with the
 * date set huge. Decorative apart from the cover's alt text: the facts live in EventHero.
 */
export function EventPoster({ event }: { event: EventData }) {
  const tz = event.timezone
  const day = (d: string) => formatInZone(d, tz, { day: "numeric" })
  const month = (d: string) => formatInZone(d, tz, { month: "short" })
  const multiDay = fmtDay(event.startDate, tz) !== fmtDay(event.endDate, tz)
  const sameMonth = month(event.startDate) === month(event.endDate)
  const dayText = multiDay && sameMonth ? `${day(event.startDate)}–${day(event.endDate)}` : day(event.startDate)
  const year = formatInZone(event.startDate, tz, { year: "numeric" })
  const weekday = formatInZone(event.startDate, tz, { weekday: "long" })
  const where = event.isOnline && event.type !== "HYBRID" ? "Online" : event.venueCity || event.venue

  if (event.coverImage) {
    return (
      <div className="relative">
        <div className="aspect-[4/3] overflow-hidden rounded-[28px] bg-raised sm:aspect-[16/9] lg:aspect-[5/2]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.coverImage} alt={event.title} className="size-full object-cover" />
        </div>
        <div
          aria-hidden
          className="font-display absolute -bottom-5 left-5 flex -rotate-2 items-stretch overflow-hidden rounded-2xl bg-lemon leading-none text-lemon-ink shadow-[0_18px_40px_-14px_rgb(0_0_0/0.5)] sm:left-8"
        >
          <span className="flex flex-col items-center justify-center px-4 py-3">
            <span className="text-[34px] font-extrabold tracking-[-0.05em] tabular-nums sm:text-[44px]">{dayText}</span>
            <span className="mt-1 text-[12px] font-bold tracking-[0.14em] uppercase">{month(event.startDate)} {year}</span>
          </span>
          <span className="flex items-center border-l-2 border-dashed border-lemon-ink/30 px-4 text-[13px] font-semibold">{weekday}</span>
        </div>
      </div>
    )
  }

  const theme = posterTheme(event.slug || event.id)
  return (
    <div
      aria-hidden
      className={cn(
        "relative isolate aspect-[4/3] overflow-hidden rounded-[28px] sm:aspect-[16/9] lg:aspect-[5/2]",
        theme.field,
      )}
    >
      <PosterPattern seed={event.slug || event.id} className="-z-10" />
      <div className="flex h-full flex-col justify-between p-6 sm:p-9 lg:p-11">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold tracking-[0.18em] uppercase sm:text-[13px]">
          {event.category && <span>{event.category}</span>}
          {event.type && event.type !== "SINGLE" && (
            <>
              <span className="size-1.5 rounded-full bg-current" />
              <span>{statusLabel(event.type)}</span>
            </>
          )}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex min-w-0 items-baseline gap-3 sm:gap-6">
            <span
              className={cn(
                "font-display leading-[0.76] font-extrabold tracking-[-0.065em] whitespace-nowrap tabular-nums",
                dayText.length > 2 ? "text-[64px] sm:text-[128px] lg:text-[180px]" : "text-[96px] sm:text-[160px] lg:text-[200px]",
              )}
            >
              {dayText}
            </span>
            <span className="font-display flex flex-col leading-none">
              <span className="text-[30px] font-extrabold tracking-[-0.03em] uppercase sm:text-[48px]">{month(event.startDate)}</span>
              <span className="mt-1.5 text-[14px] font-semibold opacity-80 sm:text-[17px]">
                {weekday} · {year}
              </span>
              {multiDay && !sameMonth && (
                <span className="mt-1 text-[14px] font-semibold opacity-80 sm:text-[17px]">to {fmtShort(event.endDate, event.timezone)}</span>
              )}
            </span>
          </div>
          {where && (
            <span className="font-display max-w-[16ch] truncate text-[20px] font-bold tracking-[-0.02em] max-sm:hidden sm:text-[26px]">{where}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The event's title block: organiser · category, status, the title set huge, then the two
 * facts people look for first, when and where, at a strong second size.
 */
export function EventHero({ event }: { event: EventData }) {
  // The register API refuses sign-ups before registrationStartDate, so the date wins over a
  // stored "registration open" status (they disagreed: pill said open, card said not open).
  const opensLater =
    event.status === "REGISTRATION_OPEN" &&
    !!event.registrationStartDate &&
    new Date(event.registrationStartDate) > new Date()
  const status = opensLater
    ? { label: `Registration opens ${fmtShort(event.registrationStartDate!, event.timezone)}`, tone: "info" as const, live: false }
    : eventStatus(event.status)
  // Dates and times on the event's clock; labelled when that isn't the viewer's.
  const tz = event.timezone
  const zoneNote = useEventZoneNote(tz, event.startDate)
  const multiDay = fmtDay(event.startDate, tz) !== fmtDay(event.endDate, tz)
  const region = [event.venueCity, event.venueState, event.venueCountry].filter(Boolean).join(", ")
  const hybrid = event.type === "HYBRID"
  const showVenue = !event.isOnline || hybrid
  const showOnline = event.isOnline || hybrid

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[14px] text-muted-foreground">
        <span className="font-medium text-foreground">{event.organization.name}</span>
        {event.category && (
          <>
            <span aria-hidden>·</span>
            <span>{event.category}</span>
          </>
        )}
        {event.type && event.type !== "SINGLE" && (
          <>
            <span aria-hidden>·</span>
            <span>{statusLabel(event.type)}</span>
          </>
        )}
        <span className="flex flex-wrap items-center gap-1.5 sm:ml-1">
          <Pill tone={status.tone} live={status.live}>{status.label}</Pill>
          {event.isFeatured && <span className="pill bg-lemon text-lemon-ink">Featured</span>}
        </span>
      </div>

      <h1 className="font-display mt-4 text-[40px] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance sm:text-[56px] xl:text-[64px]">
        {event.title}
      </h1>
      {event.shortDescription && (
        <p className="mt-5 max-w-[56ch] text-[18px] leading-relaxed text-muted-foreground">{event.shortDescription}</p>
      )}

      <dl className="mt-8 grid overflow-hidden rounded-[22px] border bg-card sm:grid-cols-2">
        <Fact icon={Calendar} label="When" srLabel="Date and time">
          <p className="font-display text-[22px] leading-tight font-bold tracking-[-0.025em] sm:text-[24px]">{fmtDay(event.startDate, tz)}</p>
          <p className="mt-1 text-[15px] text-muted-foreground tabular-nums">
            {fmtTime(event.startDate, tz)} &ndash; {fmtTime(event.endDate, tz)}
          </p>
          {multiDay && <p className="text-[15px] text-muted-foreground">to {fmtDay(event.endDate, tz)}</p>}
          {zoneNote && <p className="text-[13px] text-muted-foreground">Times in {zoneNote}</p>}
        </Fact>
        {/* A hybrid event happens in both places: show the venue and the online part. */}
        {showVenue && (
          <Fact icon={MapPin} label={hybrid ? "Where (in person)" : "Where"} srLabel="Venue">
            <p className="font-display text-[22px] leading-tight font-bold tracking-[-0.025em] sm:text-[24px]">{event.venue || "Venue TBA"}</p>
            {event.venueAddress && <p className="mt-1 text-[15px] text-muted-foreground">{event.venueAddress}</p>}
            {region && <p className="text-[15px] text-muted-foreground">{region}</p>}
            {hybrid && <p className="text-[13px] text-muted-foreground">In person</p>}
          </Fact>
        )}
        {showOnline && (
          <Fact icon={Monitor} label="Online" srLabel="Where (online)">
            <p className="font-display text-[22px] leading-tight font-bold tracking-[-0.025em] sm:text-[24px]">
              {event.onlinePlatform ? statusLabel(event.onlinePlatform) : hybrid ? "Join online" : "Online event"}
            </p>
            <p className="mt-1 text-[15px] text-muted-foreground">{hybrid ? "Online too: the link is shared after you register" : "Online"}</p>
          </Fact>
        )}
      </dl>
    </div>
  )
}

function Fact({
  icon: Icon,
  label,
  srLabel,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  label: string
  srLabel: string
  children: React.ReactNode
}) {
  return (
    // dashed dividers between facts, like the tear lines on a ticket
    <div className="min-w-0 border-dashed border-border p-5 not-first:border-t-2 sm:p-6 sm:not-first:border-t-0 sm:not-first:border-l-2 sm:[&:nth-child(3)]:col-span-2 sm:[&:nth-child(3)]:border-t-2 sm:[&:nth-child(3)]:border-l-0">
      <dt className="flex items-center gap-2 text-[12px] font-bold tracking-[0.14em] text-brand uppercase">
        <Icon className="size-4" aria-hidden />
        <span aria-hidden>{label}</span>
        <span className="sr-only">{srLabel}</span>
      </dt>
      <dd className="mt-2.5 min-w-0">{children}</dd>
    </div>
  )
}

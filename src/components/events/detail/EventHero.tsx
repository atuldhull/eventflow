"use client"

import { Calendar, MapPin, Monitor } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { statusLabel } from "@/lib/status-tone"
import { formatInZone } from "@/lib/event-time"
import { useEventZoneNote } from "@/hooks/useViewerTimeZone"
import { eventStatus, fmtDay, fmtShort, fmtTime, type EventData } from "./types"

/**
 * The top of the event page: the cover (or a quiet date plate when there is
 * no photo), then organiser · category, the title and the two facts people
 * look for first: when and where.
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
      {event.coverImage ? (
        <div className="aspect-[16/9] overflow-hidden rounded-xl bg-raised">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.coverImage} alt={event.title} className="size-full object-cover" />
        </div>
      ) : (
        <div
          aria-hidden
          className="flex aspect-[2/1] flex-col items-center justify-center rounded-xl border border-rule bg-raised leading-none sm:aspect-[5/2]"
        >
          <span className="text-[13px] text-muted-foreground">{formatInZone(event.startDate, tz, { weekday: "long" })}</span>
          <span className="mt-2 text-[56px] font-semibold tracking-[-0.03em] tabular-nums sm:text-[64px]">{formatInZone(event.startDate, tz, { day: "numeric" })}</span>
          <span className="mt-2 text-sm text-muted-foreground">{formatInZone(event.startDate, tz, { month: "long", year: "numeric" })}</span>
        </div>
      )}

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] text-muted-foreground">
          <span>{event.organization.name}</span>
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
            {event.isFeatured && <Pill tone="neutral">Featured</Pill>}
          </span>
        </div>

        <h1 className="mt-3 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance sm:text-[32px]">
          {event.title}
        </h1>
        {event.shortDescription && (
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">{event.shortDescription}</p>
        )}

        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div className="flex gap-3">
            <dt className="mt-0.5 shrink-0 text-muted-foreground">
              <Calendar className="size-4" aria-hidden />
              <span className="sr-only">Date and time</span>
            </dt>
            <dd className="min-w-0 text-sm">
              <p className="font-medium">{fmtDay(event.startDate, tz)}</p>
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {fmtTime(event.startDate, tz)} &ndash; {fmtTime(event.endDate, tz)}
              </p>
              {multiDay && <p className="text-[13px] text-muted-foreground">to {fmtDay(event.endDate, tz)}</p>}
              {zoneNote && <p className="text-[13px] text-muted-foreground">Times in {zoneNote}</p>}
            </dd>
          </div>
          {/* A hybrid event happens in both places: show the venue and the online part. */}
          {showVenue && (
            <div className="flex gap-3">
              <dt className="mt-0.5 shrink-0 text-muted-foreground">
                <MapPin className="size-4" aria-hidden />
                <span className="sr-only">Venue</span>
              </dt>
              <dd className="min-w-0 text-sm">
                <p className="font-medium">{event.venue || "Venue TBA"}</p>
                {event.venueAddress && <p className="text-[13px] text-muted-foreground">{event.venueAddress}</p>}
                {region && <p className="text-[13px] text-muted-foreground">{region}</p>}
                {hybrid && <p className="text-[13px] text-muted-foreground">In person</p>}
              </dd>
            </div>
          )}
          {showOnline && (
            <div className="flex gap-3">
              <dt className="mt-0.5 shrink-0 text-muted-foreground">
                <Monitor className="size-4" aria-hidden />
                <span className="sr-only">Where (online)</span>
              </dt>
              <dd className="min-w-0 text-sm">
                <p className="font-medium">{event.onlinePlatform ? statusLabel(event.onlinePlatform) : hybrid ? "Join online" : "Online event"}</p>
                <p className="text-[13px] text-muted-foreground">{hybrid ? "Online too: the link is shared after you register" : "Online"}</p>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

"use client"

import { MapPin } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { EventSection } from "./EventSection"
import { fmtTime, type EventData } from "./types"

/** A time column and what happens: read down the left edge, details on the right. */
export function EventSchedule({ sessions, timeZone }: { sessions: EventData["sessions"]; timeZone?: string | null }) {
  if (sessions.length === 0) return null
  return (
    <EventSection id="schedule" title="Schedule">
      <ol className="-mt-1 divide-y divide-rule">
        {sessions.map((s) => (
          <li key={s.id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-4 py-3 sm:grid-cols-[112px_minmax(0,1fr)]">
            <div className="text-sm text-muted-foreground tabular-nums">
              <p>{fmtTime(s.startTime, timeZone)}</p>
              <p className="text-[13px] text-faint">to {fmtTime(s.endTime, timeZone)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.title}</p>
              {s.speaker && <p className="mt-0.5 text-[13px] text-foreground/80">{s.speaker}</p>}
              {s.description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{s.description}</p>}
              {(s.venue || s.track) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
                  {s.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden />
                      {s.venue}
                    </span>
                  )}
                  {s.track && <Pill tone="neutral">{s.track}</Pill>}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </EventSection>
  )
}

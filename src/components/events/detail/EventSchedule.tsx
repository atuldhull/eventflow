"use client"

import { MapPin } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { EventSection } from "./EventSection"
import { fmtTime, type EventData } from "./types"

/** A running order: big start times down a timeline on the left, what happens on the right. */
export function EventSchedule({ sessions, timeZone }: { sessions: EventData["sessions"]; timeZone?: string | null }) {
  if (sessions.length === 0) return null
  return (
    <EventSection id="schedule" title="Schedule" meta={sessions.length}>
      <ol className="relative">
        {/* the timeline's spine */}
        <span aria-hidden className="absolute top-3 bottom-3 left-[7px] w-[2px] rounded-full bg-gradient-to-b from-lavender via-lavender/40 to-transparent" />
        {sessions.map((s) => (
          <li key={s.id} className="relative pb-7 pl-9 last:pb-0">
            <span aria-hidden className="absolute top-2 left-0 size-4 rounded-full border-[3px] border-background bg-lavender ring-1 ring-lavender/50" />
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-[132px_minmax(0,1fr)]">
              <div className="tabular-nums">
                <p className="font-display text-[22px] leading-none font-extrabold tracking-[-0.03em]">{fmtTime(s.startTime, timeZone)}</p>
                <p className="mt-1.5 text-[13px] text-muted-foreground">to {fmtTime(s.endTime, timeZone)}</p>
              </div>
              <div className="min-w-0 rounded-[18px] border bg-card p-4 sm:p-5">
                <p className="text-[16px] font-semibold">{s.title}</p>
                {s.speaker && <p className="mt-1 text-[14px] font-medium text-brand">{s.speaker}</p>}
                {s.description && <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{s.description}</p>}
                {(s.venue || s.track) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
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
            </div>
          </li>
        ))}
      </ol>
    </EventSection>
  )
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"

/**
 * The people on stage, gathered from the schedule's sessions (name, bio, what they're
 * presenting). Renders nothing when no session names a speaker.
 */
export function EventSpeakers({ sessions }: { sessions: EventData["sessions"] }) {
  const speakers = new Map<string, { name: string; bio: string | null; talks: string[] }>()
  for (const s of sessions) {
    const name = s.speaker?.trim()
    if (!name) continue
    const entry = speakers.get(name) ?? { name, bio: null, talks: [] }
    if (!entry.bio && s.speakerBio) entry.bio = s.speakerBio
    entry.talks.push(s.title)
    speakers.set(name, entry)
  }
  if (speakers.size === 0) return null
  const list = [...speakers.values()]

  return (
    <EventSection id="speakers" title="Speakers" meta={list.length}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {list.map((sp, i) => (
          <li key={sp.name} className="flex gap-4 rounded-[22px] border bg-card p-5">
            <span
              aria-hidden
              className={`font-display flex size-14 shrink-0 items-center justify-center rounded-2xl text-[20px] font-extrabold tracking-[-0.03em] ${
                i % 2 ? "bg-lemon text-lemon-ink" : "bg-lavender text-charcoal"
              } ${i % 2 ? "rotate-3" : "-rotate-3"}`}
            >
              {initials(sp.name)}
            </span>
            <div className="min-w-0">
              <p className="font-display text-[19px] leading-tight font-bold tracking-[-0.02em]">{sp.name}</p>
              {sp.bio && <p className="mt-1 line-clamp-3 text-[14px] leading-relaxed text-muted-foreground">{sp.bio}</p>}
              <p className="mt-2 text-[13px] text-muted-foreground">
                <span className="sr-only">Presenting: </span>
                {sp.talks.join(" · ")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </EventSection>
  )
}

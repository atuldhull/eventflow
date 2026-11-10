"use client"

import Link from "next/link"
import { Mail, Phone } from "lucide-react"
import { AddToCalendar } from "@/components/events/AddToCalendar"
import type { EventData } from "./types"

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"

/** Who runs the event and how to reach them, then Add to calendar. */
export function EventOrganizer({ event }: { event: EventData }) {
  const org = event.organization
  return (
    <div className="space-y-3">
      <section aria-labelledby="organizer-heading" className="rounded-lg border bg-card p-5">
        <h2 id="organizer-heading" className="text-base font-semibold tracking-[-0.01em]">Organizer</h2>
        <div className="mt-3 flex items-start gap-3">
          {org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo} alt={org.name} className="size-10 shrink-0 rounded-md border border-rule object-cover" />
          ) : (
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md border border-rule bg-raised text-[13px] font-semibold text-muted-foreground">
              {initials(org.name)}
            </span>
          )}
          <div className="min-w-0">
            {org.slug ? (
              <Link href={`/org/${org.slug}`} className="text-sm font-medium underline-offset-4 hover:text-brand hover:underline">
                {org.name}
              </Link>
            ) : (
              <p className="text-sm font-medium">{org.name}</p>
            )}
            {org.description && <p className="mt-0.5 line-clamp-3 text-[13px] text-muted-foreground">{org.description}</p>}
          </div>
        </div>
        {(event.contactEmail || event.contactPhone) && (
          <div className="mt-4 space-y-0.5 border-t border-rule pt-3">
            {event.contactEmail && (
              <a href={`mailto:${event.contactEmail}`} className="flex min-h-9 items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{event.contactEmail}</span>
              </a>
            )}
            {event.contactPhone && (
              <a href={`tel:${event.contactPhone}`} className="flex min-h-9 items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11">
                <Phone className="size-3.5 shrink-0" aria-hidden />
                <span className="tabular-nums">{event.contactPhone}</span>
              </a>
            )}
          </div>
        )}
      </section>
      <AddToCalendar
        title={event.title}
        description={event.shortDescription}
        startDate={event.startDate}
        endDate={event.endDate}
        venue={event.isOnline ? undefined : event.venue}
        isOnline={event.isOnline}
        onlinePlatform={event.onlinePlatform}
        slug={event.slug}
        size="default"
        className="w-full"
      />
    </div>
  )
}

"use client"

import Link from "next/link"
import { ArrowUpRight, Mail, Phone } from "lucide-react"
import { AddToCalendar } from "@/components/events/AddToCalendar"
import { EventSectionHeading } from "./EventSection"
import type { EventData } from "./types"

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"

/** Who runs the event and how to reach them, then Add to calendar: one dark panel. */
export function EventOrganizer({ event }: { event: EventData }) {
  const org = event.organization
  return (
    <section aria-labelledby="organizer-heading" className="border-t border-rule pt-10">
      <EventSectionHeading id="organizer-heading">Organizer</EventSectionHeading>
      <div className="relative mt-6 overflow-hidden rounded-[26px] bg-[#111111] p-6 text-white sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-lavender/30 blur-[90px]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
          {org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo} alt={org.name} className="size-16 shrink-0 rounded-2xl border border-white/10 bg-white object-cover" />
          ) : (
            <span
              aria-hidden
              className="font-display flex size-16 shrink-0 -rotate-3 items-center justify-center rounded-2xl bg-lemon text-[22px] font-extrabold tracking-[-0.03em] text-lemon-ink"
            >
              {initials(org.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {org.slug ? (
              <Link
                href={`/org/${org.slug}`}
                className="group font-display inline-flex items-center gap-1.5 rounded-sm text-[24px] leading-tight font-extrabold tracking-[-0.03em] hover:text-lemon"
              >
                {org.name}
                <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </Link>
            ) : (
              <p className="font-display text-[24px] leading-tight font-extrabold tracking-[-0.03em]">{org.name}</p>
            )}
            {org.description && <p className="mt-2 line-clamp-3 max-w-[60ch] text-[15px] leading-relaxed text-white/65">{org.description}</p>}

            {(event.contactEmail || event.contactPhone) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {event.contactEmail && (
                  <a
                    href={`mailto:${event.contactEmail}`}
                    className="flex min-h-10 max-w-full items-center gap-2 rounded-full border border-white/15 px-4 text-[14px] text-white/85 transition-colors hover:border-lavender hover:text-white pointer-coarse:min-h-11"
                  >
                    <Mail className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{event.contactEmail}</span>
                  </a>
                )}
                {event.contactPhone && (
                  <a
                    href={`tel:${event.contactPhone}`}
                    className="flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-[14px] text-white/85 transition-colors hover:border-lavender hover:text-white pointer-coarse:min-h-11"
                  >
                    <Phone className="size-4 shrink-0" aria-hidden />
                    <span className="tabular-nums">{event.contactPhone}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="relative mt-6 border-t-2 border-dashed border-white/15 pt-6">
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
            className="h-11 w-full border-white/20 bg-transparent text-white hover:border-lavender hover:bg-lavender/15 hover:text-white sm:w-auto sm:px-6"
          />
        </div>
      </div>
    </section>
  )
}

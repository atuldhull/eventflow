"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Heart, Calendar, MapPin, Monitor } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { DashEmpty, PosterFallback } from "../_components/bits"
import { SaveEventButton } from "@/components/events/SaveEventButton"
import { cn } from "@/lib/utils"

interface SavedEvent {
  id: string
  title: string
  slug: string
  shortDescription: string | null
  coverImage: string | null
  category: string | null
  status: string
  startDate: string
  endDate: string
  venue: string | null
  venueCity: string | null
  isOnline: boolean
  isPaid: boolean
  currentRegistrations: number
  maxCapacity: number | null
  savedAt: string
  organization: { id: string; name: string; logo: string | null }
}

export default function SavedEventsPage() {
  const [events, setEvents] = useState<SavedEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/users/me/saved-events", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setEvents(json.data || [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved"
        description={isLoading ? "Events you've saved to come back to later" : `${events.length} event${events.length === 1 ? "" : "s"} you've saved to come back to later`}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading saved events">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[300px] rounded-lg" />)}
        </div>
      ) : events.length === 0 ? (
        <DashEmpty title="No saved events yet" description="Tap the heart on any event to save it here for later.">
          <Link href="/events" className={buttonVariants()}>
            <Heart className="size-4" /> Browse events
          </Link>
        </DashEmpty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const start = new Date(event.startDate)
            return (
              <article key={event.id} className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/20">
                <Link href={`/events/${event.slug}`} className="block" tabIndex={-1} aria-hidden>
                  <div className="relative h-40 overflow-hidden bg-raised [&>img]:transition-transform [&>img]:duration-500 group-hover:[&>img]:scale-[1.03] motion-reduce:[&>img]:transition-none">
                    {event.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.coverImage} alt="" className="size-full object-cover" />
                    ) : (
                      <PosterFallback seed={event.slug} date={start} category={event.category} />
                    )}
                  </div>
                </Link>
                {/* pinned over the cover, outside the link so the heart doesn't also navigate */}
                <div className="absolute top-2 right-2">
                  <SaveEventButton eventId={event.id} />
                </div>
                {event.status === "ONGOING" && (
                  <div className="absolute top-2 left-2">
                    <Pill tone="positive" live>Live now</Pill>
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <span className="truncate">{event.organization.name}</span>
                    {event.category && <><span aria-hidden>·</span><span className="shrink-0">{event.category}</span></>}
                  </p>
                  <Link href={`/events/${event.slug}`} className="line-clamp-2 text-[15px] leading-snug font-semibold hover:underline">
                    {event.title}
                  </Link>
                  {event.shortDescription && (
                    <p className="line-clamp-2 text-[13px] text-muted-foreground">{event.shortDescription}</p>
                  )}
                  <div className="mt-auto space-y-1.5 border-t border-rule pt-3 text-[13px] text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 shrink-0" />
                      <span className="tabular-nums">
                        {start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}
                        {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      {event.isOnline ? <Monitor className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
                      <span className="truncate">{event.isOnline ? "Online event" : (event.venue || event.venueCity || "Venue TBA")}</span>
                    </p>
                  </div>
                  <Link href={`/events/${event.slug}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-full")}>
                    View event
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

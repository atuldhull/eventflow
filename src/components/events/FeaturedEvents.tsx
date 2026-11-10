"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { EventCard } from "@/components/events/EventCard"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FeaturedEvent {
  id: string; title: string; slug: string; shortDescription: string; coverImage: string | null
  category: string; startDate: string; venue: string | null; venueCity: string | null
  isOnline: boolean; isPaid: boolean; currentRegistrations: number
  maxCapacity: number | null; status: string; isFeatured: boolean
  organization: { name: string }
}

export function FeaturedEvents() {
  const [events, setEvents] = useState<FeaturedEvent[]>([])

  // Featured upcoming events first, topped up with the next public events that haven't
  // ended. Both endpoints list PUBLIC events only.
  useEffect(() => {
    let cancelled = false
    const load = async (url: string): Promise<FeaturedEvent[]> => {
      try {
        const json = await (await fetch(url)).json()
        return json.success && Array.isArray(json.data) ? json.data : []
      } catch {
        return []
      }
    }
    ;(async () => {
      const featured = await load("/api/events/featured")
      let list = featured.slice(0, 3)
      if (list.length < 3) {
        const upcoming = await load("/api/events?limit=6&upcoming=1")
        const seen = new Set(list.map((e) => e.id))
        list = [...list, ...upcoming.filter((e) => !seen.has(e.id))].slice(0, 3)
      }
      if (!cancelled) setEvents(list)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (events.length === 0) return null

  return (
    <section aria-labelledby="featured-events-heading" className="py-16 sm:py-20">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-brand">
              <span className="h-[2px] w-6 rounded-full bg-lemon" aria-hidden />
              On the programme
            </p>
            <h2 id="featured-events-heading" className="font-display mt-3 text-[32px] leading-[1.02] font-extrabold tracking-[-0.04em] sm:text-[48px]">
              Upcoming events
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">Discover what&apos;s happening soon</p>
          </div>
          <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "group h-11 gap-2 px-5 max-sm:w-full")}>
            Browse all events <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} variant="compact" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

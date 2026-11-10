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
            <h2 id="featured-events-heading" className="text-[22px] leading-7 font-semibold tracking-[-0.015em] sm:text-[28px] sm:leading-9">Upcoming events</h2>
            <p className="mt-1.5 text-[15px] text-muted-foreground">Discover what&apos;s happening soon</p>
          </div>
          <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "gap-2 max-sm:w-full")}>
            Browse all events <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
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

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Calendar, MapPin, Monitor, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FeaturedEvent {
  id: string; title: string; slug: string; shortDescription: string; coverImage: string | null
  category: string; startDate: string; venue: string | null; venueCity: string | null
  isOnline: boolean; isPaid: boolean; currentRegistrations: number
  organization: { name: string }
}

export function FeaturedEvents() {
  const [events, setEvents] = useState<FeaturedEvent[]>([])

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await fetch("/api/events/featured")
        const json = await res.json()
        if (json.success && json.data?.length > 0) setEvents(json.data.slice(0, 3))
      } catch {}
    }
    fetchFeatured()
  }, [])

  // Also try the regular events endpoint if featured returns empty
  useEffect(() => {
    if (events.length > 0) return
    async function fetchRecent() {
      try {
        const res = await fetch("/api/events?limit=3")
        const json = await res.json()
        if (json.success && json.data?.length > 0) setEvents(json.data.slice(0, 3))
      } catch {}
    }
    const timer = setTimeout(fetchRecent, 500)
    return () => clearTimeout(timer)
  }, [events.length])

  if (events.length === 0) return null

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">Upcoming Events</h2>
          <p className="text-muted-foreground mt-2">Discover what's happening soon</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {events.map((event) => {
            const date = new Date(event.startDate)
            return (
              <Link key={event.id} href={`/events/${event.slug}`}>
                <Card className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
                  <div className="relative h-36 bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    {event.coverImage ? (
                      <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <Calendar className="h-10 w-10 text-primary/20" />
                    )}
                    <div className="absolute top-2 left-2 bg-white dark:bg-zinc-900 rounded-lg px-2 py-0.5 text-center shadow-sm">
                      <p className="text-[10px] font-bold text-primary leading-none">{date.toLocaleString("en-IN", { month: "short" }).toUpperCase()}</p>
                      <p className="text-base font-bold leading-tight">{date.getDate()}</p>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{event.organization.name}</span>
                      <span>·</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5">{event.category}</Badge>
                    </div>
                    <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">{event.title}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-auto pt-2">
                      {event.isOnline ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                      <span>{event.isOnline ? "Online" : (event.venue || event.venueCity || "TBA")}</span>
                      <span className="ml-auto">{event.isPaid ? "Paid" : "Free"}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
        <div className="text-center mt-8">
          <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            Browse All Events <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

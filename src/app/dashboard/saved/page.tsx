"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Heart, Calendar, MapPin, Monitor, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/PageHeader"
import { SaveEventButton } from "@/components/events/SaveEventButton"
import { PageTransition, Stagger, StaggerItem, FadeInScale } from "@/components/motion/primitives"
import { TiltCard } from "@/components/motion/TiltCard"
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
    <PageTransition className="space-y-6">
      <PageHeader
        title="Saved Events"
        description="Events you've saved to come back to later"
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <FadeInScale><Card className="p-12 text-center space-y-3">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="font-medium">No saved events yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tap the heart on any event to save it here for later.
            </p>
          </div>
          <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
            Browse events
          </Link>
        </Card></FadeInScale>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const start = new Date(event.startDate)
            return (
              <StaggerItem key={event.id}>
              <TiltCard maxTilt={6}>
              <Card className="overflow-hidden flex flex-col">
                <Link href={`/events/${event.slug}`} className="block">
                  <div className="relative h-32 bg-linear-to-br from-primary/10 to-primary/5">
                    {event.coverImage ? (
                      <img src={event.coverImage} alt={event.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Calendar className="h-10 w-10 text-primary/20" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <SaveEventButton eventId={event.id} />
                    </div>
                    {event.status === "ONGOING" && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-emerald-500 text-white text-[10px]">Live Now</Badge>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-4 flex-1 flex flex-col space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{event.organization.name}</span>
                    {event.category && <><span>·</span><span>{event.category}</span></>}
                  </div>
                  <Link href={`/events/${event.slug}`} className="font-semibold leading-snug hover:text-primary line-clamp-2">
                    {event.title}
                  </Link>
                  {event.shortDescription && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{event.shortDescription}</p>
                  )}
                  <div className="pt-2 mt-auto border-t space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>
                        {start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {" \u00B7 "}
                        {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {event.isOnline ? <Monitor className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
                      <span className="truncate">
                        {event.isOnline ? "Online Event" : (event.venue || event.venueCity || "Venue TBA")}
                      </span>
                    </div>
                  </div>
                  <Link href={`/events/${event.slug}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full mt-2")}>
                    View event
                  </Link>
                </div>
              </Card>
              </TiltCard>
              </StaggerItem>
            )
          })}
        </Stagger>
      )}
    </PageTransition>
  )
}

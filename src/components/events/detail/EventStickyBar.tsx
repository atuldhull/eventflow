"use client"

import Link from "next/link"
import { Calendar, MapPin, Monitor, Ticket } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AddToCalendar } from "@/components/events/AddToCalendar"
import { ShareModal } from "@/components/events/ShareModal"
import { fmtShort, fmtTime, type EventData } from "./types"

interface Props {
  event: EventData
  eventUrl: string
  canRegister: boolean
  lowestPrice: number
}

export function EventStickyBar({ event, eventUrl, canRegister, lowestPrice }: Props) {
  return (
    <div className="border-b bg-background/95 backdrop-blur-sm sticky top-16 z-40">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{fmtShort(event.startDate)} · {fmtTime(event.startDate)}</span>
          <span className="flex items-center gap-1.5">
            {event.isOnline ? <Monitor className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
            {event.isOnline ? (event.onlinePlatform || "Online") : (event.venue || event.venueCity || "Venue TBA")}
          </span>
          {event.isPaid
            ? <span className="flex items-center gap-1.5"><Ticket className="h-4 w-4" />From &#8377;{lowestPrice}</span>
            : <span className="flex items-center gap-1.5"><Ticket className="h-4 w-4" />Free</span>}
        </div>
        <div className="flex items-center gap-2">
          <AddToCalendar title={event.title} description={event.shortDescription} startDate={event.startDate} endDate={event.endDate} venue={event.isOnline ? undefined : event.venue} isOnline={event.isOnline} onlinePlatform={event.onlinePlatform} slug={event.slug} />
          <ShareModal url={eventUrl} title={event.title} description={event.shortDescription} />
          {canRegister && (
            <Link href={`/events/${event.slug}/register`} className={cn(buttonVariants(), "gap-2")}>
              Register Now
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

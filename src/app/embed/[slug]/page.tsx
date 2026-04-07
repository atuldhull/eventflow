"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { Calendar, MapPin, Monitor, Ticket, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EmbedEvent {
  title: string; slug: string; shortDescription: string; startDate: string; endDate: string
  venue: string | null; venueCity: string | null; isOnline: boolean; isPaid: boolean
  currentRegistrations: number; maxCapacity: number | null; status: string; category: string
  ticketTypes: { id: string; name: string; price: number }[]
}

export default function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [event, setEvent] = useState<EmbedEvent | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch(`/api/events/${slug}`)
        const json = await res.json()
        if (json.success) setEvent(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [slug])

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!event) return <div className="text-center py-8 text-sm text-muted-foreground">Event not found</div>

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  const lowestPrice = event.ticketTypes.length > 0 ? Math.min(...event.ticketTypes.map(t => t.price)) : 0
  const canRegister = ["PUBLISHED", "REGISTRATION_OPEN"].includes(event.status)

  return (
    <div className="max-w-md mx-auto p-4 font-sans">
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{event.category}</Badge>
            {event.isPaid && <Badge className="text-[10px]">From ₹{lowestPrice}</Badge>}
            {!event.isPaid && <Badge variant="secondary" className="text-[10px]">Free</Badge>}
          </div>
          <h2 className="text-lg font-bold leading-snug">{event.title}</h2>
          <p className="text-sm text-muted-foreground line-clamp-2">{event.shortDescription}</p>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0" /><span>{fmtDate(event.startDate)} · {fmtTime(event.startDate)}</span></div>
            <div className="flex items-center gap-2">
              {event.isOnline ? <Monitor className="h-4 w-4 shrink-0" /> : <MapPin className="h-4 w-4 shrink-0" />}
              <span>{event.isOnline ? "Online Event" : (event.venue || event.venueCity || "TBA")}</span>
            </div>
            <div className="flex items-center gap-2"><Ticket className="h-4 w-4 shrink-0" /><span>{event.currentRegistrations} registered{event.maxCapacity ? ` / ${event.maxCapacity}` : ""}</span></div>
          </div>
        </div>
        <div className="border-t p-4">
          {canRegister ? (
            <a href={`${typeof window !== "undefined" ? window.location.origin : ""}/events/${slug}/register`} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants(), "w-full")}>
              {event.isPaid ? `Register · From ₹${lowestPrice}` : "Register for Free"}
            </a>
          ) : (
            <Button disabled className="w-full">Registration Closed</Button>
          )}
        </div>
        <div className="border-t px-4 py-2 text-center">
          <a href={`${typeof window !== "undefined" ? window.location.origin : ""}/events/${slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
            Powered by EventFlow
          </a>
        </div>
      </div>
    </div>
  )
}

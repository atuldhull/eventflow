"use client"

import { useState, useEffect, use } from "react"
import { Calendar, MapPin, Monitor, Ticket, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Perforation } from "@/components/tickets/Perforation"
import { cn } from "@/lib/utils"

interface EmbedEvent {
  title: string; slug: string; shortDescription: string; startDate: string; endDate: string
  venue: string | null; venueCity: string | null; isOnline: boolean; isPaid: boolean
  currentRegistrations: number; maxCapacity: number | null; status: string; category: string
  ticketTypes: { id: string; name: string; price: number }[]
}

// Poster colours for the widget's header band, picked from the slug so each event looks its own
const POSTERS = [
  "bg-lemon text-lemon-ink",
  "bg-lavender text-charcoal",
  "bg-charcoal text-white dark:bg-[#0e0e0e]",
]

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
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const start = new Date(event.startDate)
  const poster = POSTERS[[...(event.slug || slug)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % POSTERS.length]

  return (
    <div className="mx-auto max-w-md p-4 font-sans">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        {/* poster band: the date set big, the category and price */}
        <div className={cn("flex items-end justify-between gap-3 px-5 pt-4 pb-5", poster)}>
          <div className="leading-none">
            <span className="text-[12px] font-semibold tracking-[0.1em] uppercase">{start.toLocaleDateString("en-IN", { month: "short" })}</span>
            <span className="font-display block text-[52px] font-extrabold tracking-[-0.05em] tabular-nums">{start.getDate()}</span>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Badge variant="secondary" className="text-[10px]">{event.category}</Badge>
            {event.isPaid && <Badge className="text-[10px]">From ₹{lowestPrice}</Badge>}
            {!event.isPaid && <Badge variant="secondary" className="text-[10px]">Free</Badge>}
          </div>
        </div>
        <Perforation notchClassName="bg-background" />
        <div className="space-y-3 p-5">
          <h2 className="font-display text-[22px] leading-[1.08] font-bold tracking-[-0.03em]">{event.title}</h2>
          <p className="line-clamp-2 text-sm text-muted-foreground">{event.shortDescription}</p>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0" /><span className="tabular-nums">{fmtDate(event.startDate)} · {fmtTime(event.startDate)}</span></div>
            <div className="flex items-center gap-2">
              {event.isOnline ? <Monitor className="h-4 w-4 shrink-0" /> : <MapPin className="h-4 w-4 shrink-0" />}
              <span>{event.isOnline ? "Online Event" : (event.venue || event.venueCity || "TBA")}</span>
            </div>
            <div className="flex items-center gap-2"><Ticket className="h-4 w-4 shrink-0" /><span className="tabular-nums">{event.currentRegistrations} registered{event.maxCapacity ? ` / ${event.maxCapacity}` : ""}</span></div>
          </div>
        </div>
        <div className="px-5 pb-5">
          {canRegister ? (
            <a
              href={`${origin}/events/${slug}/register`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-lemon px-5 text-[15px] font-semibold text-lemon-ink transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_var(--lemon)]"
            >
              {event.isPaid ? `Register · From ₹${lowestPrice}` : "Register for Free"}
            </a>
          ) : (
            <Button disabled className="h-11 w-full">Registration Closed</Button>
          )}
        </div>
        <div className="border-t border-dashed px-4 py-2.5 text-center">
          <a href={`${origin}/events/${slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
            Powered by EventFlow
          </a>
        </div>
      </div>
    </div>
  )
}

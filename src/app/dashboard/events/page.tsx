"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Calendar, MapPin, Monitor, Loader2, XCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/PageHeader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

interface UserEvent {
  registrationId: string
  status: string
  id: string
  title: string
  slug: string
  startDate: string
  venue: string | null
  venueCity: string | null
  isOnline: boolean
  category: string
  organization: { name: string }
}

export default function MyEventsPage() {
  const [events, setEvents] = useState<UserEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState("upcoming")

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/users/me/dashboard")
        const json = await res.json()
        if (json.success) {
          // Use upcoming events from dashboard, plus fetch all registrations
          const regRes = await fetch("/api/users/me/tickets?timeframe=all")
          const regJson = await regRes.json()
          if (regJson.success) {
            setEvents(regJson.data.map((t: any) => ({
              registrationId: t.id,
              status: t.status,
              id: t.event.id,
              title: t.event.title,
              slug: t.event.slug,
              startDate: t.event.startDate,
              venue: t.event.venue,
              venueCity: t.event.venueCity,
              isOnline: t.event.isOnline,
              category: t.event.category || "Event",
              organization: t.event.organization || { name: "—" },
            })))
          }
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetchEvents()
  }, [])

  const now = new Date()
  const upcoming = events.filter((e) => new Date(e.startDate) >= now)
  const past = events.filter((e) => new Date(e.startDate) < now)
  const displayed = tab === "upcoming" ? upcoming : tab === "past" ? past : events

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <PageHeader title="My Events" description={`${events.length} event${events.length !== 1 ? "s" : ""} registered`} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="all">All ({events.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {displayed.length > 0 ? (
        <div className="space-y-3">
          {displayed.map((event) => (
            <Link key={event.registrationId} href={`/events/${event.slug}`}>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium truncate">{event.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(event.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className="flex items-center gap-1">
                        {event.isOnline ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                        {event.isOnline ? "Online" : (event.venue || event.venueCity || "TBA")}
                      </span>
                      <span>{event.organization.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px]">{event.category}</Badge>
                    <Badge variant={event.status === "ACTIVE" || event.status === "VALID" ? "default" : "secondary"} className="text-[10px]">{event.status}</Badge>
                    {event.status !== "CANCELLED" && new Date(event.startDate) > new Date() && (
                      <Button variant="ghost" size="icon-sm" className="text-destructive h-7 w-7" onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!confirm("Cancel this registration? This cannot be undone.")) return
                        try {
                          const res = await fetch(`/api/registrations/${event.registrationId}/cancel`, { method: "POST" })
                          const json = await res.json()
                          if (json.success) { toast.success("Registration cancelled"); setEvents(events.filter(ev => ev.registrationId !== event.registrationId)) }
                          else toast.error(json.message)
                        } catch { toast.error("Failed to cancel") }
                      }}><XCircle className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="font-medium">No {tab === "all" ? "" : tab + " "}events</p>
          <p className="text-sm text-muted-foreground mt-1">Events you register for will appear here.</p>
          <Link href="/events" className="text-sm text-primary hover:underline mt-3 inline-block">Browse Events</Link>
        </div>
      )}
    </div>
  )
}

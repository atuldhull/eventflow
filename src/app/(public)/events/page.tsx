"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Calendar, Search, MapPin, Monitor, Users, ArrowRight, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useDebounce } from "@/hooks/useDebounce"
import { SaveEventButton } from "@/components/events/SaveEventButton"
import { PageTransition, Stagger, StaggerItem, FadeInScale } from "@/components/motion/primitives"
import { cn } from "@/lib/utils"

const CATEGORIES = ["All", "TECH", "CULTURAL", "SPORTS", "WORKSHOP", "HACKATHON", "CONFERENCE", "SEMINAR", "WEBINAR", "FEST", "COMPETITION", "MEETUP", "OTHER"]

interface PublicEvent {
  id: string
  title: string
  slug: string
  shortDescription: string
  coverImage: string | null
  category: string
  startDate: string
  venue: string | null
  venueCity: string | null
  isOnline: boolean
  isPaid: boolean
  currentRegistrations: number
  maxCapacity: number | null
  status: string
  isFeatured: boolean
  organization: { name: string }
}

const statusLabel: Record<string, string> = {
  PUBLISHED: "Upcoming",
  REGISTRATION_OPEN: "Open",
  ONGOING: "Live Now",
  COMPLETED: "Ended",
}

export default function EventsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 400)
  const [category, setCategory] = useState("All")
  const [pricing, setPricing] = useState("")
  const [page, setPage] = useState(1)
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "12" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (category !== "All") params.set("category", category)
      if (pricing) params.set("pricing", pricing)

      const res = await fetch(`/api/events?${params}`)
      const json = await res.json()
      if (json.success) {
        setEvents(json.data)
        setTotal(json.pagination.total)
        setTotalPages(json.pagination.totalPages)
      }
    } catch {} finally {
      setIsLoading(false)
    }
  }, [page, debouncedSearch, category, pricing])

  useEffect(() => { fetchEvents() }, [fetchEvents])
  useEffect(() => { setPage(1) }, [debouncedSearch, category, pricing])

  const formatDate = (d: string) => {
    const date = new Date(d)
    return {
      day: date.getDate(),
      month: date.toLocaleString("en-IN", { month: "short" }).toUpperCase(),
      time: date.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      full: date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    }
  }

  return (
    <PageTransition className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <FadeInScale className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Discover Events</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Find events happening near you. Workshops, hackathons, conferences, and more.
        </p>
      </FadeInScale>

      {/* Search */}
      <div className="max-w-xl mx-auto relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search events by title, category, or keyword..."
          className="pl-10 h-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              category === cat
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-primary/10"
            )}
          >
            {cat === "All" ? "All" : cat.charAt(0) + cat.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Pricing filter */}
      <div className="flex justify-center gap-2">
        {[
          { value: "", label: "All Events" },
          { value: "free", label: "Free" },
          { value: "paid", label: "Paid" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPricing(opt.value)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              pricing === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
        {total > 0 && <span className="text-xs text-muted-foreground self-center ml-2">{total} event{total !== 1 ? "s" : ""}</span>}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Events Grid */}
      {!isLoading && events.length > 0 && (
        <Stagger key={`${debouncedSearch}-${category}-${pricing}-${page}`} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const date = formatDate(event.startDate)
            const spotsLeft = event.maxCapacity ? event.maxCapacity - event.currentRegistrations : null
            const isAlmostFull = spotsLeft !== null && spotsLeft <= 10 && spotsLeft > 0
            const isFull = spotsLeft !== null && spotsLeft <= 0

            return (
              <StaggerItem key={event.id}>
                <Link href={`/events/${event.slug}`}>
                <Card className="group overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col">
                  {/* Image / Date Banner */}
                  <div className="relative h-40 bg-linear-to-br from-primary/10 to-primary/5 flex items-center justify-center overflow-hidden">
                    {event.coverImage ? (
                      <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <Calendar className="h-12 w-12 text-primary/20" />
                    )}
                    {/* Date badge */}
                    <div className="absolute top-3 left-3 bg-white dark:bg-zinc-900 rounded-lg px-2 py-1 text-center shadow-sm">
                      <p className="text-xs font-bold text-primary leading-none">{date.month}</p>
                      <p className="text-lg font-bold leading-tight">{date.day}</p>
                    </div>
                    {/* Status badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      {event.status === "ONGOING" && (
                        <Badge className="bg-emerald-500 text-white text-[10px]">Live Now</Badge>
                      )}
                      {event.isFeatured && (
                        <Badge className="bg-amber-500 text-white text-[10px]">Featured</Badge>
                      )}
                      <SaveEventButton eventId={event.id} />
                    </div>
                    {/* Spots warning */}
                    {isAlmostFull && (
                      <div className="absolute bottom-2 right-2">
                        <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-[10px]">
                          Only {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                        </Badge>
                      </div>
                    )}
                    {isFull && (
                      <div className="absolute bottom-2 right-2">
                        <Badge variant="secondary" className="bg-zinc-800 text-white text-[10px]">Sold Out</Badge>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{event.organization.name}</span>
                      <span>·</span>
                      <span>{event.category}</span>
                    </div>
                    <h3 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {event.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{event.shortDescription}</p>

                    <div className="pt-2 space-y-1.5 border-t mt-auto">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{date.full} · {date.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {event.isOnline ? <Monitor className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
                        <span>{event.isOnline ? "Online Event" : (event.venue || event.venueCity || "Venue TBA")}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="h-3 w-3 shrink-0" />
                          <span>{event.currentRegistrations} registered</span>
                        </div>
                        <Badge variant={event.isPaid ? "default" : "secondary"} className="text-[10px]">
                          {event.isPaid ? "Paid" : "Free"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
                </Link>
              </StaggerItem>
            )
          })}
        </Stagger>
      )}

      {/* Empty state */}
      {!isLoading && events.length === 0 && (
        <FadeInScale className="text-center py-16">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">No events found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search || category !== "All" || pricing
              ? "Try different search terms or filters."
              : "Check back soon for upcoming events."}
          </p>
          {(search || category !== "All" || pricing) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => { setSearch(""); setCategory("All"); setPricing(""); setPage(1) }}
            >
              Clear filters
            </Button>
          )}
        </FadeInScale>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </PageTransition>
  )
}

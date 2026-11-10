"use client"

import { useState, useEffect, useCallback } from "react"
import { CalendarSearch, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/EmptyState"
import { EventCard, EventCardSkeleton } from "@/components/events/EventCard"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"

const CATEGORIES = ["TECH", "CULTURAL", "SPORTS", "WORKSHOP", "HACKATHON", "CONFERENCE", "SEMINAR", "WEBINAR", "FEST", "COMPETITION", "MEETUP", "OTHER"]

const PRICING = [
  { value: "", label: "All" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
] as const

type Pricing = (typeof PRICING)[number]["value"]

// Upcoming (and ongoing) events by default, soonest first; past ones only when asked for.
const WHEN = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past events" },
] as const

type When = (typeof WHEN)[number]["value"]

/** "TEAM_BUILDING" and "Team building" are the same category */
const categoryKey = (c: string) => c.trim().replace(/[\s_]+/g, "_").toUpperCase()

const categoryLabel = (c: string) => {
  const words = c.trim().replace(/_/g, " ").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

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
  hasEnded?: boolean
  price?: { min: number; max: number; tiers: number } | null
  currentRegistrations: number
  maxCapacity: number | null
  status: string
  isFeatured: boolean
  organization: { name: string }
}

export function EventsBrowser({
  initialCategory = "",
  initialSearch = "",
  initialPricing = "",
  initialWhen = "",
}: {
  initialCategory?: string
  initialSearch?: string
  initialPricing?: string
  initialWhen?: string
}) {
  // A category from the URL (the landing page's links, a shared link) selects its chip;
  // one that isn't in the list gets a chip of its own so the filter stays visible.
  const initialKey = initialCategory ? categoryKey(initialCategory) : ""
  const [chips] = useState(() => (initialKey && !CATEGORIES.includes(initialKey) ? [...CATEGORIES, initialKey] : CATEGORIES))

  const [search, setSearch] = useState(initialSearch)
  const debouncedSearch = useDebounce(search, 400)
  const [category, setCategory] = useState(initialKey || "All")
  const [pricing, setPricing] = useState<Pricing>(initialPricing === "free" || initialPricing === "paid" ? initialPricing : "")
  const [when, setWhen] = useState<When>(initialWhen === "past" ? "past" : "upcoming")
  const [page, setPage] = useState(1)
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  const fetchEvents = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setLoadFailed(false)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "12" })
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim())
      if (category !== "All") params.set("category", category)
      if (pricing) params.set("pricing", pricing)
      params.set(when, "1")

      const res = await fetch(`/api/events?${params}`, { signal })
      const json = await res.json()
      if (signal?.aborted) return
      if (json.success) {
        setEvents(json.data)
        setTotal(json.pagination.total)
        setTotalPages(json.pagination.totalPages)
      } else {
        setLoadFailed(true)
      }
    } catch {
      if (!signal?.aborted) setLoadFailed(true)
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [page, debouncedSearch, category, pricing, when])

  useEffect(() => {
    const controller = new AbortController()
    fetchEvents(controller.signal)
    return () => controller.abort()
  }, [fetchEvents])

  // Keep the filters in the address bar so the view can be shared and survives a reload
  useEffect(() => {
    const url = new URL(window.location.href)
    const set = (key: string, value: string) => (value ? url.searchParams.set(key, value) : url.searchParams.delete(key))
    set("category", category === "All" ? "" : category)
    set("search", debouncedSearch.trim())
    set("pricing", pricing)
    set("when", when === "past" ? "past" : "")
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url)
  }, [category, debouncedSearch, pricing, when])

  // Every filter change starts again from the first page
  const chooseCategory = (value: string) => { setCategory(value); setPage(1) }
  const choosePricing = (value: Pricing) => { setPricing(value); setPage(1) }
  const chooseWhen = (value: When) => { setWhen(value); setPage(1) }
  const changeSearch = (value: string) => { setSearch(value); setPage(1) }

  const hasFilters = !!(search || category !== "All" || pricing)

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pt-8 pb-16 sm:px-8 lg:pt-12 lg:pb-24">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">Events</h1>
          <p className="mt-2 max-w-[56ch] text-[15px] text-muted-foreground">
            Workshops, hackathons, conferences and more, happening near you.
          </p>
        </div>
        <p className="text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
          {total > 0 && `${total} event${total !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Search + price */}
      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-[440px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search events"
            placeholder="Search by title, category or keyword"
            className="h-10 pl-9 pointer-coarse:h-11"
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
          />
        </div>
        <div role="group" aria-label="When" className="inline-flex w-full rounded-md bg-muted p-[3px] md:ml-auto md:w-auto">
          {WHEN.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => chooseWhen(opt.value)}
              aria-pressed={when === opt.value}
              className={cn(
                "h-8 flex-1 rounded-[5px] px-4 text-[13px] font-medium whitespace-nowrap transition-colors md:flex-none pointer-coarse:h-10",
                when === opt.value
                  ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Price" className="inline-flex w-full rounded-md bg-muted p-[3px] md:w-auto">
          {PRICING.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => choosePricing(opt.value)}
              aria-pressed={pricing === opt.value}
              className={cn(
                "h-8 flex-1 rounded-[5px] px-4 text-[13px] font-medium transition-colors md:flex-none pointer-coarse:h-10",
                pricing === opt.value
                  ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories: one scrolling row on phones, wrapped on wider screens */}
      <div className="-mx-5 mt-4 overflow-x-auto px-5 scrollbar-none sm:mx-0 sm:overflow-visible sm:px-0">
        <div role="group" aria-label="Category" className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
          {["All", ...chips].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => chooseCategory(cat)}
              aria-pressed={category === cat}
              className={cn(
                "press h-8 shrink-0 rounded-sm border px-3 text-[13px] font-medium whitespace-nowrap transition-colors pointer-coarse:h-10",
                category === cat
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-input hover:text-foreground"
              )}
            >
              {cat === "All" ? "All" : categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="mt-8">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6" aria-busy="true" aria-label="Loading events">
            {Array.from({ length: 6 }).map((_, i) => <EventCardSkeleton key={i} />)}
          </div>
        ) : loadFailed ? (
          <EmptyState
            variant="page"
            icon={CalendarSearch}
            title="Couldn't load events"
            description="Check your connection and try again."
          >
            <Button variant="outline" onClick={() => fetchEvents()}>Try again</Button>
          </EmptyState>
        ) : events.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} showSave />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            variant="page"
            icon={CalendarSearch}
            title="No events found"
            description={hasFilters ? "Try different search terms or filters." : when === "past" ? "No past events to show yet." : "Check back soon for upcoming events, or look through past events."}
          >
            {hasFilters && (
              <Button
                variant="outline"
                onClick={() => { setSearch(""); setCategory("All"); setPricing(""); setPage(1) }}
              >
                Clear filters
              </Button>
            )}
          </EmptyState>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3 border-t border-rule pt-6 sm:justify-center">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="px-3 text-[13px] text-muted-foreground tabular-nums">Page {page} of {totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </nav>
      )}
    </div>
  )
}

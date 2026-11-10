"use client"

import { useState, useEffect, useCallback } from "react"
import { MotionConfig, motion } from "framer-motion"
import { CalendarSearch, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { EventCard, EventCardSkeleton } from "@/components/events/EventCard"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const

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

  // The header's big number: what the current view holds, named for that view
  const countLabel = hasFilters
    ? `matching ${when === "past" ? "past " : ""}event${total !== 1 ? "s" : ""}`
    : when === "past"
      ? `past event${total !== 1 ? "s" : ""}`
      : `upcoming event${total !== 1 ? "s" : ""}`

  return (
    <MotionConfig reducedMotion="user">
      {/* Header: the programme's title, set big, with the live count beside it */}
      <header className="relative isolate overflow-hidden border-b border-rule">
        <div aria-hidden className="fx-aurora pointer-events-none absolute inset-0 -z-10">
          <span className="top-[-40%] left-[-10%] size-[460px] bg-lavender/30 dark:bg-lavender/25" />
          <span className="top-[-30%] right-[-6%] size-[380px] bg-lemon/30 dark:bg-lemon/10" />
        </div>
        <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-5 pt-12 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:pt-16 lg:pb-14">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-brand">
              <span className="h-[2px] w-6 rounded-full bg-lemon" aria-hidden />
              The programme
            </p>
            <h1 className="font-display mt-4 text-[56px] leading-[0.92] font-extrabold tracking-[-0.05em] sm:text-[88px] lg:text-[112px]">
              What&apos;s{" "}
              <span className="relative z-0 inline-block px-[0.06em] whitespace-nowrap">
                <motion.span
                  aria-hidden
                  className="absolute -inset-x-[0.04em] top-[0.08em] bottom-[0.02em] -z-10 origin-left -rotate-[2deg] rounded-[0.14em] bg-lemon"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
                />
                <span className="relative text-lemon-ink">on</span>
              </span>
            </h1>
            <p className="mt-5 max-w-[50ch] text-[17px] leading-relaxed text-muted-foreground">
              Workshops, hackathons, conferences and more, happening near you.
            </p>
          </div>

          {/* the live count, on a ticket-stub tile */}
          <div
            className="flex items-center gap-4 self-start justify-self-start rounded-[22px] border bg-card/80 py-4 pr-6 pl-5 backdrop-blur-sm lg:self-end"
            aria-live="polite"
          >
            <div className="font-display text-[56px] leading-none font-extrabold tracking-[-0.05em] text-brand tabular-nums">
              {isLoading && total === 0 ? <Skeleton className="h-12 w-12" /> : total.toLocaleString("en-IN")}
            </div>
            <div className="self-stretch border-l-2 border-dashed border-border flex flex-col justify-center py-1 pl-4 text-[14px] leading-snug">
              <span className="block font-semibold">{countLabel}</span>
              {totalPages > 1 && <span className="block text-muted-foreground tabular-nums">Page {page} of {totalPages}</span>}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1240px] px-5 pt-8 pb-16 sm:px-8 lg:pt-10 lg:pb-24">
        {/* Search + when + price */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-[440px]">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="Search events"
              placeholder="Search by title, category or keyword"
              className="h-12 rounded-full pl-11 text-[15px]"
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:ml-auto">
            <div role="group" aria-label="When" className="inline-flex w-full rounded-full border bg-card p-1 sm:w-auto">
              {WHEN.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => chooseWhen(opt.value)}
                  aria-pressed={when === opt.value}
                  className={cn(
                    "h-10 flex-1 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-colors sm:flex-none pointer-coarse:h-11",
                    when === opt.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Price" className="inline-flex w-full rounded-full border bg-card p-1 sm:w-auto">
              {PRICING.map((opt) => (
                <button
                  key={opt.value || "all"}
                  type="button"
                  onClick={() => choosePricing(opt.value)}
                  aria-pressed={pricing === opt.value}
                  className={cn(
                    "h-10 flex-1 rounded-full px-4 text-[14px] font-semibold transition-colors sm:flex-none pointer-coarse:h-11",
                    pricing === opt.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Categories: one scrolling row on phones, wrapped on wider screens */}
        <div className="-mx-5 mt-5 overflow-x-auto px-5 py-1.5 scrollbar-none sm:mx-0 sm:overflow-visible sm:px-0">
          <div role="group" aria-label="Category" className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {["All", ...chips].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => chooseCategory(cat)}
                aria-pressed={category === cat}
                className={cn(
                  "press h-9 shrink-0 rounded-full border px-4 text-[14px] font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-300 pointer-coarse:h-11 motion-safe:hover:-translate-y-0.5",
                  category === cat
                    ? "-rotate-[1.5deg] border-transparent bg-lemon font-semibold text-lemon-ink shadow-[0_8px_24px_-10px_var(--lemon)]"
                    : "border-border text-muted-foreground hover:border-lavender hover:text-foreground",
                )}
              >
                {cat === "All" ? "All" : categoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="mt-10">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7" aria-busy="true" aria-label="Loading events">
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
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
              {events.map((event, i) => (
                <motion.li
                  key={event.id}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: Math.min(i, 8) * 0.05, ease: EASE }}
                >
                  <EventCard event={event} showSave />
                </motion.li>
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
          <nav aria-label="Pagination" className="mt-12 flex items-center justify-between gap-3 border-t border-rule pt-6 sm:justify-center">
            <Button variant="outline" className="h-11 px-5" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="px-3 text-[14px] text-muted-foreground tabular-nums">
              Page <span className="font-display text-[18px] font-bold text-foreground">{page}</span> of {totalPages}
            </span>
            <Button variant="outline" className="h-11 px-5" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </nav>
        )}
      </div>
    </MotionConfig>
  )
}

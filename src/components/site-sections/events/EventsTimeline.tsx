"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Calendar, MapPin, Monitor, ArrowRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

interface EventItem { id: string; title: string; slug: string; shortDescription: string; startDate: string; venue: string | null; venueCity: string | null; isOnline: boolean; isPaid: boolean; status: string }

export function EventsTimeline({ config, content, siteStyles, orgSlug, isPreview }: SectionProps) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isPreview || !orgSlug) {
      setEvents([
        { id: "1", title: "Opening Ceremony", slug: "#", shortDescription: "Welcome and keynote", startDate: new Date(Date.now() + 3 * 86400000).toISOString(), venue: "Main Hall", venueCity: "Mumbai", isOnline: false, isPaid: false, status: "PUBLISHED" },
        { id: "2", title: "Workshop Series", slug: "#", shortDescription: "Hands-on learning sessions", startDate: new Date(Date.now() + 10 * 86400000).toISOString(), venue: null, venueCity: null, isOnline: true, isPaid: true, status: "PUBLISHED" },
        { id: "3", title: "Community Meetup", slug: "#", shortDescription: "Networking and discussions", startDate: new Date(Date.now() + 20 * 86400000).toISOString(), venue: "Co-working Space", venueCity: "Bangalore", isOnline: false, isPaid: false, status: "PUBLISHED" },
        { id: "4", title: "Annual Celebration", slug: "#", shortDescription: "Year-end awards and party", startDate: new Date(Date.now() + 40 * 86400000).toISOString(), venue: "Grand Ballroom", venueCity: "Delhi", isOnline: false, isPaid: false, status: "PUBLISHED" },
      ])
      setIsLoading(false)
      return
    }
    async function fetchEvents() {
      try {
        const res = await fetch(`/api/events?limit=${config.maxEvents || 10}&sort=start_date&order=asc`)
        const json = await res.json()
        if (json.success) setEvents(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchEvents()
  }, [orgSlug, config.maxEvents, isPreview])

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  const fmtMonth = (d: string) => new Date(d).toLocaleDateString("en-IN", { month: "long", year: "numeric" })

  // Group by month if configured
  const grouped: Record<string, EventItem[]> = {}
  if (config.groupByMonth) {
    events.forEach((e) => { const key = fmtMonth(e.startDate); if (!grouped[key]) grouped[key] = []; grouped[key].push(e) })
  } else {
    grouped["all"] = events
  }

  const isUpcoming = (d: string) => new Date(d) > new Date()

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          {content.heading && <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold" style={{ color: siteStyles.textColor }}>{content.heading}</h2>}
          {content.subtitle && <p className="mt-3 opacity-60" style={{ color: siteStyles.textColor }}>{content.subtitle}</p>}
        </motion.div>

        {isLoading ? (
          <div className="max-w-2xl mx-auto space-y-6">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex gap-4"><Skeleton className="h-4 w-4 rounded-full shrink-0 mt-1" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>)}</div>
        ) : (
          <div className="max-w-3xl mx-auto relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px md:-translate-x-px" style={{ backgroundColor: siteStyles.primaryColor + "30" }} />

            {Object.entries(grouped).map(([month, monthEvents]) => (
              <div key={month}>
                {/* Month header */}
                {config.groupByMonth && month !== "all" && (
                  <motion.div className="relative mb-6 ml-12 md:ml-0 md:text-center" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
                    <span className="inline-block px-4 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: siteStyles.primaryColor + "15", color: siteStyles.primaryColor }}>{month}</span>
                  </motion.div>
                )}

                {monthEvents.map((event, i) => {
                  const isRight = i % 2 === 0
                  const upcoming = isUpcoming(event.startDate)

                  return (
                    <motion.div key={event.id} className={`relative flex items-start gap-4 mb-8 ${isRight ? "md:flex-row" : "md:flex-row-reverse"}`}
                      initial={{ opacity: 0, x: isRight ? -30 : 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-30px" }} transition={{ duration: 0.5 }}>

                      {/* Dot */}
                      <div className="absolute left-4 md:left-1/2 -translate-x-1/2 z-10">
                        <div className={`h-3 w-3 rounded-full border-2 ${upcoming ? "" : "opacity-50"}`} style={{ backgroundColor: upcoming ? siteStyles.primaryColor : "gray", borderColor: siteStyles.backgroundColor }}>
                          {upcoming && i === 0 && (
                            <motion.div className="absolute inset-0 rounded-full" style={{ backgroundColor: siteStyles.primaryColor }} animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
                          )}
                        </div>
                      </div>

                      {/* Card */}
                      <div className={`ml-12 md:ml-0 ${isRight ? "md:mr-[52%]" : "md:ml-[52%]"} flex-1`}>
                        <Link href={`/events/${event.slug}`}>
                          <div className="group rounded-xl border p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5" style={{ borderColor: siteStyles.textColor + "10", borderRadius: siteStyles.borderRadius }}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold group-hover:opacity-80 transition-opacity" style={{ color: siteStyles.textColor }}>{event.title}</h3>
                                <p className="text-sm opacity-60 mt-1 line-clamp-2" style={{ color: siteStyles.textColor }}>{event.shortDescription}</p>
                                <div className="flex flex-wrap gap-3 mt-2 text-xs opacity-50" style={{ color: siteStyles.textColor }}>
                                  {config.showDates && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(event.startDate)}</span>}
                                  <span className="flex items-center gap-1">{fmtTime(event.startDate)}</span>
                                  <span className="flex items-center gap-1">
                                    {event.isOnline ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                                    {event.isOnline ? "Online" : event.venue || event.venueCity || "TBA"}
                                  </span>
                                </div>
                              </div>
                              <ArrowRight className="h-4 w-4 opacity-30 group-hover:opacity-70 transition-opacity shrink-0 mt-1" style={{ color: siteStyles.primaryColor }} />
                            </div>
                          </div>
                        </Link>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
export default EventsTimeline

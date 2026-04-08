"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Calendar, MapPin, Monitor, Users } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

interface EventItem { id: string; title: string; slug: string; shortDescription: string; coverImage: string | null; category: string; startDate: string; venue: string | null; venueCity: string | null; isOnline: boolean; isPaid: boolean; currentRegistrations: number; maxCapacity: number | null }

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }
const item = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

const PLACEHOLDER_EVENTS: EventItem[] = [
  { id: "1", title: "Community Meetup", slug: "#", shortDescription: "Monthly gathering", coverImage: null, category: "MEETUP", startDate: new Date(Date.now() + 7 * 86400000).toISOString(), venue: "City Hall", venueCity: "Mumbai", isOnline: false, isPaid: false, currentRegistrations: 42, maxCapacity: 100 },
  { id: "2", title: "Tech Workshop", slug: "#", shortDescription: "Learn something new", coverImage: null, category: "WORKSHOP", startDate: new Date(Date.now() + 14 * 86400000).toISOString(), venue: null, venueCity: null, isOnline: true, isPaid: true, currentRegistrations: 78, maxCapacity: 150 },
  { id: "3", title: "Annual Celebration", slug: "#", shortDescription: "End of year event", coverImage: null, category: "FEST", startDate: new Date(Date.now() + 30 * 86400000).toISOString(), venue: "Grand Ballroom", venueCity: "Delhi", isOnline: false, isPaid: false, currentRegistrations: 200, maxCapacity: 500 },
]

export function EventsGrid({ config, content, siteStyles, orgSlug, isPreview }: SectionProps) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const cols = parseInt(config.columns || "3")

  useEffect(() => {
    if (isPreview || !config.autoFetch || !orgSlug) {
      setEvents(PLACEHOLDER_EVENTS.slice(0, config.maxEvents || 6))
      setIsLoading(false)
      return
    }
    async function fetchEvents() {
      try {
        const res = await fetch(`/api/events?limit=${config.maxEvents || 6}`)
        const json = await res.json()
        if (json.success) setEvents(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchEvents()
  }, [orgSlug, config.autoFetch, config.maxEvents, isPreview])

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        {/* Heading */}
        <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          {content.heading && <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold" style={{ color: siteStyles.textColor }}>{content.heading}</h2>}
          {content.subtitle && <p className="mt-3 opacity-60" style={{ color: siteStyles.textColor }}>{content.subtitle}</p>}
        </motion.div>

        {/* Loading */}
        {isLoading && (
          <div className={`grid gap-6 ${cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {Array.from({ length: config.maxEvents || 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border"><Skeleton className="h-44 w-full" /><div className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>
            ))}
          </div>
        )}

        {/* Events */}
        {!isLoading && events.length > 0 && (
          <motion.div
            className={`grid gap-6 ${cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}
            variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            {events.map((event) => (
              <motion.div key={event.id} variants={item}>
                <Link href={`/events/${event.slug}`}>
                  <div className="group rounded-2xl overflow-hidden border hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col" style={{ borderRadius: siteStyles.borderRadius, borderColor: siteStyles.textColor + "10" }}>
                    <div className="relative h-44 overflow-hidden" style={{ backgroundColor: siteStyles.primaryColor + "10" }}>
                      {event.coverImage ? (
                        <Image src={event.coverImage} alt={event.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 33vw" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Calendar className="h-10 w-10 opacity-20" style={{ color: siteStyles.primaryColor }} /></div>
                      )}
                      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: siteStyles.primaryColor }}>{event.category}</div>
                      {event.isPaid && <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 text-zinc-800">Paid</div>}
                    </div>
                    <div className="p-4 flex-1 flex flex-col space-y-2">
                      <h3 className="font-semibold line-clamp-2 group-hover:opacity-80 transition-opacity" style={{ color: siteStyles.textColor }}>{event.title}</h3>
                      <div className="space-y-1 mt-auto pt-2 border-t" style={{ borderColor: siteStyles.textColor + "10" }}>
                        <p className="flex items-center gap-1.5 text-xs opacity-60" style={{ color: siteStyles.textColor }}><Calendar className="h-3 w-3 shrink-0" />{fmtDate(event.startDate)} &middot; {fmtTime(event.startDate)}</p>
                        <p className="flex items-center gap-1.5 text-xs opacity-60" style={{ color: siteStyles.textColor }}>
                          {event.isOnline ? <Monitor className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
                          {event.isOnline ? "Online" : event.venue || event.venueCity || "TBA"}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs opacity-60" style={{ color: siteStyles.textColor }}><Users className="h-3 w-3 shrink-0" />{event.currentRegistrations} registered</p>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Empty state */}
        {!isLoading && events.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 opacity-20 mb-4" style={{ color: siteStyles.primaryColor }} />
            <p className="opacity-60" style={{ color: siteStyles.textColor }}>{content.emptyMessage || "No upcoming events right now. Check back soon!"}</p>
          </div>
        )}

        {/* View All */}
        {content.ctaText && (
          <motion.div className="text-center mt-10" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <Link href={content.ctaHref || "/events"} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border font-medium text-sm transition-all hover:scale-105" style={{ borderColor: siteStyles.primaryColor, color: siteStyles.primaryColor }}>
              {content.ctaText}
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  )
}

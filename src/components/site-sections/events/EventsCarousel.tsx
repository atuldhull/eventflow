"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Calendar, MapPin, Monitor, ChevronLeft, ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { SectionProps } from "@/lib/site-builder/section-renderer"

interface EventItem { id: string; title: string; slug: string; coverImage: string | null; category: string; startDate: string; venue: string | null; venueCity: string | null; isOnline: boolean; isPaid: boolean; currentRegistrations: number }

export function EventsCarousel({ config, content, siteStyles, orgSlug, isPreview }: SectionProps) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isPreview || !orgSlug) {
      setEvents([
        { id: "1", title: "Community Run", slug: "#", coverImage: null, category: "SPORTS", startDate: new Date(Date.now() + 5 * 86400000).toISOString(), venue: "City Park", venueCity: "Mumbai", isOnline: false, isPaid: false, currentRegistrations: 85 },
        { id: "2", title: "Photography Walk", slug: "#", coverImage: null, category: "CREATIVE", startDate: new Date(Date.now() + 12 * 86400000).toISOString(), venue: null, venueCity: null, isOnline: true, isPaid: true, currentRegistrations: 34 },
        { id: "3", title: "Yoga Morning", slug: "#", coverImage: null, category: "SPORTS", startDate: new Date(Date.now() + 20 * 86400000).toISOString(), venue: "Beach", venueCity: "Goa", isOnline: false, isPaid: false, currentRegistrations: 120 },
        { id: "4", title: "Coding Workshop", slug: "#", coverImage: null, category: "TECH", startDate: new Date(Date.now() + 25 * 86400000).toISOString(), venue: null, venueCity: null, isOnline: true, isPaid: true, currentRegistrations: 200 },
      ])
      setIsLoading(false)
      return
    }
    async function fetchEvents() {
      try {
        const res = await fetch(`/api/events?limit=${config.maxEvents || 8}`)
        const json = await res.json()
        if (json.success) setEvents(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchEvents()
  }, [orgSlug, config.maxEvents, isPreview])

  const scroll = useCallback((dir: "left" | "right") => {
    if (!scrollRef.current) return
    const cardWidth = scrollRef.current.firstElementChild?.clientWidth || 320
    scrollRef.current.scrollBy({ left: dir === "left" ? -cardWidth - 24 : cardWidth + 24, behavior: "smooth" })
  }, [])

  // Auto scroll
  useEffect(() => {
    if (!config.autoScroll || events.length <= 3) return
    const interval = setInterval(() => scroll("right"), (config.scrollInterval || 5) * 1000)
    return () => clearInterval(interval)
  }, [config.autoScroll, config.scrollInterval, events.length, scroll])

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })

  return (
    <section style={{ backgroundColor: siteStyles.backgroundColor }}>
      <div className="container mx-auto px-4">
        <motion.div className="flex items-end justify-between mb-8" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: siteStyles.textColor }}>{content.heading || "Featured Events"}</h2>
          <div className="flex gap-2">
            <button onClick={() => scroll("left")} className="p-2 rounded-full border hover:bg-black/5 transition-colors" style={{ borderColor: siteStyles.textColor + "20" }}><ChevronLeft className="h-5 w-5" style={{ color: siteStyles.textColor }} /></button>
            <button onClick={() => scroll("right")} className="p-2 rounded-full border hover:bg-black/5 transition-colors" style={{ borderColor: siteStyles.textColor + "20" }}><ChevronRight className="h-5 w-5" style={{ color: siteStyles.textColor }} /></button>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex gap-6 overflow-hidden">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="min-w-[300px] rounded-2xl overflow-hidden border"><Skeleton className="h-48 w-full" /><div className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>)}</div>
        ) : (
          <div ref={scrollRef} className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4" style={{ scrollbarWidth: "none" }}>
            {events.map((event) => (
              <Link key={event.id} href={`/events/${event.slug}`} className="min-w-[300px] sm:min-w-[340px] snap-start shrink-0">
                <motion.div className="group rounded-2xl overflow-hidden border hover:shadow-xl transition-all duration-300 h-full" style={{ borderRadius: siteStyles.borderRadius, borderColor: siteStyles.textColor + "10" }} whileHover={{ y: -4 }}>
                  <div className="relative h-48 overflow-hidden" style={{ backgroundColor: siteStyles.primaryColor + "10" }}>
                    {event.coverImage ? (
                      <Image src={event.coverImage} alt={event.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="340px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Calendar className="h-10 w-10 opacity-20" style={{ color: siteStyles.primaryColor }} /></div>
                    )}
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: siteStyles.primaryColor }}>{event.category}</div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold line-clamp-1" style={{ color: siteStyles.textColor }}>{event.title}</h3>
                    <div className="flex items-center gap-3 text-xs opacity-60" style={{ color: siteStyles.textColor }}>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(event.startDate)}</span>
                      <span className="flex items-center gap-1">
                        {event.isOnline ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                        {event.isOnline ? "Online" : event.venue || event.venueCity || "TBA"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
export default EventsCarousel

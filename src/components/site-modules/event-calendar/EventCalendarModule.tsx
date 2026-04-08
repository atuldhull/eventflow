"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Clock, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface CalendarEvent {
  id: string
  title: string
  startDate: string
  endDate?: string
  location?: string
  isOnline?: boolean
  slug?: string
  category?: string
}

const DAY_NAMES_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DAY_NAMES_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const CATEGORY_COLORS = ["bg-primary", "bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number, startDay: string) {
  const d = new Date(year, month, 1).getDay()
  return startDay === "monday" ? (d === 0 ? 6 : d - 1) : d
}

const SAMPLE_EVENTS: CalendarEvent[] = [
  { id: "e1", title: "Morning Run", startDate: new Date(Date.now() + 2 * 86400000).toISOString(), location: "City Park", category: "fitness" },
  { id: "e2", title: "Tech Meetup", startDate: new Date(Date.now() + 5 * 86400000).toISOString(), isOnline: true, category: "tech" },
  { id: "e3", title: "Workshop", startDate: new Date(Date.now() + 8 * 86400000).toISOString(), location: "Community Center", category: "workshop" },
  { id: "e4", title: "Annual Gala", startDate: new Date(Date.now() + 12 * 86400000).toISOString(), location: "Grand Hotel", category: "social" },
]

export function EventCalendarModule({ config, orgSlug, isPreview }: ModuleProps) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchedMonths, setFetchedMonths] = useState<Record<string, CalendarEvent[]>>({})

  const monthKey = `${currentYear}-${currentMonth}`

  const fetchEvents = useCallback(async (year: number, month: number) => {
    const key = `${year}-${month}`
    if (fetchedMonths[key]) { setEvents(fetchedMonths[key]); setIsLoading(false); return }
    if (isPreview) { setEvents(SAMPLE_EVENTS); setIsLoading(false); return }
    setIsLoading(true)
    try {
      const dateFrom = new Date(year, month, 1).toISOString()
      const dateTo = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
      const res = await fetch(`/api/events?orgSlug=${orgSlug}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      const json = await res.json()
      const data = json.success ? json.data : []
      setFetchedMonths(prev => ({ ...prev, [key]: data }))
      setEvents(data)
    } catch { setEvents([]) } finally { setIsLoading(false) }
  }, [orgSlug, isPreview, fetchedMonths])

  useEffect(() => { fetchEvents(currentYear, currentMonth) }, [currentYear, currentMonth])

  const navigateMonth = (dir: number) => {
    setSelectedDay(null)
    let newMonth = currentMonth + dir
    let newYear = currentYear
    if (newMonth > 11) { newMonth = 0; newYear++ }
    if (newMonth < 0) { newMonth = 11; newYear-- }
    setCurrentMonth(newMonth)
    setCurrentYear(newYear)
  }

  const goToToday = () => {
    setCurrentMonth(today.getMonth())
    setCurrentYear(today.getFullYear())
    setSelectedDay(today.getDate())
  }

  const startDay = config.startDay || "monday"
  const dayNames = startDay === "monday" ? DAY_NAMES_MON : DAY_NAMES_SUN
  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth, startDay)

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {}
    events.forEach(evt => {
      const d = new Date(evt.startDate)
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const day = d.getDate()
        if (!map[day]) map[day] = []
        map[day].push(evt)
      }
    })
    return map
  }, [events, currentMonth, currentYear])

  const selectedDayEvents = selectedDay ? eventsByDay[selectedDay] || [] : []
  const isToday = (day: number) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    const cats = new Set<string>()
    events.forEach(e => { if (e.category) cats.add(e.category) })
    Array.from(cats).forEach((cat, i) => { map[cat] = CATEGORY_COLORS[i % CATEGORY_COLORS.length] })
    return map
  }, [events])

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="h-5 w-5" />{monthName}</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => navigateMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={goToToday} className="text-xs">Today</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => navigateMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {dayNames.map(d => (
            <div key={d} className={`py-2 text-center text-xs font-medium text-muted-foreground ${(d === "Sat" || d === "Sun") && config.showWeekends === false ? "hidden" : ""}`}>{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="p-2 min-h-[4rem] border-b border-r bg-muted/20" />)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayEvents = eventsByDay[day] || []
            const maxShow = config.maxEventsPerDay || 3
            const dotStyle = config.eventDotStyle || "dot"

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`p-1.5 min-h-[4rem] border-b border-r cursor-pointer transition-colors hover:bg-muted/30 ${
                  isToday(day) && config.highlightToday !== false ? "bg-primary/5 font-bold" : ""
                } ${selectedDay === day ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
              >
                <span className={`text-xs ${isToday(day) && config.highlightToday !== false ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : ""}`}>{day}</span>
                {dayEvents.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, maxShow).map(evt => {
                      const color = config.colorByCategory !== false && evt.category ? categoryColorMap[evt.category] || "bg-primary" : "bg-primary"
                      return dotStyle === "bar" ? (
                        <div key={evt.id} className={`h-1 rounded-full ${color} w-full`} title={evt.title} />
                      ) : dotStyle === "badge" ? (
                        <div key={evt.id} className="text-[9px] leading-tight truncate text-primary font-medium" title={evt.title}>{evt.title}</div>
                      ) : (
                        <div key={evt.id} className={`h-1.5 w-1.5 rounded-full ${color} inline-block mr-0.5`} title={evt.title} />
                      )
                    })}
                    {dayEvents.length > maxShow && <span className="text-[9px] text-muted-foreground">+{dayEvents.length - maxShow}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day events */}
      <AnimatePresence>
        {selectedDay !== null && selectedDayEvents.length > 0 && (
          <motion.div className="space-y-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <h4 className="text-sm font-semibold">{new Date(currentYear, currentMonth, selectedDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h4>
            {selectedDayEvents.map(evt => (
              <Card key={evt.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{evt.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(evt.startDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                    {evt.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{evt.location}</span>}
                    {evt.isOnline && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />Online</span>}
                  </div>
                </div>
                {evt.slug && (
                  <a href={`/events/${evt.slug}`}><Button variant="ghost" size="icon-sm"><ExternalLink className="h-3.5 w-3.5" /></Button></a>
                )}
              </Card>
            ))}
          </motion.div>
        )}
        {selectedDay !== null && selectedDayEvents.length === 0 && (
          <motion.p className="text-sm text-muted-foreground text-center py-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>No events on this day</motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function Globe({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
}

export default EventCalendarModule

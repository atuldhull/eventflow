"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Calendar, QrCode } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { useRBAC } from "@/hooks/useRBAC"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { cn } from "@/lib/utils"
import { DateBlock, Registered, ZoneNote, fmtDay, fmtTime } from "../events/_components/event-admin"

interface HubEvent {
  id: string
  title: string
  status: string
  startDate: string
  endDate: string
  /** Event.timezone: dates and times show on the event's clock */
  timezone?: string | null
  venue: string | null
  isOnline: boolean
  currentRegistrations: number
  maxCapacity: number | null
}

const UPCOMING_DAYS = 30

/** The organization's events by when they happen: running today, then the next few weeks. */
export default function CheckInHubPage() {
  const { currentOrganizationId } = useRBAC()
  const [today, setToday] = useState<HubEvent[]>([])
  const [upcoming, setUpcoming] = useState<HubEvent[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrganizationId) return
    let cancelled = false
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const horizon = new Date(start)
    horizon.setDate(horizon.getDate() + UPCOMING_DAYS)

    const list = async (params: Record<string, string>) => {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/events?${new URLSearchParams({ sort: "start", limit: "20", ...params })}`)
      const json = await res.json()
      return json.success ? (json.data as HubEvent[]) : []
    }

    ;(async () => {
      try {
        const [onDay, ongoing, later] = await Promise.all([
          // Overlapping today (including ones that finished earlier today, for late arrivals)
          list({ from: start.toISOString(), to: end.toISOString(), status: "PUBLISHED,REGISTRATION_OPEN,REGISTRATION_CLOSED,ONGOING,COMPLETED" }),
          // Marked as running, whatever their dates say
          list({ status: "ONGOING" }),
          list({ from: end.toISOString(), to: horizon.toISOString(), status: "PUBLISHED,REGISTRATION_OPEN,REGISTRATION_CLOSED" }),
        ])
        if (cancelled) return
        const now = [...ongoing, ...onDay.filter((e) => !ongoing.some((o) => o.id === e.id))]
        setToday(now)
        setUpcoming(later.filter((e) => new Date(e.startDate) >= end && !now.some((o) => o.id === e.id)))
      } catch {
        if (!cancelled) { setToday([]); setUpcoming([]) }
      } finally {
        if (!cancelled) setLoadedFor(currentOrganizationId)
      }
    })()
    return () => { cancelled = true }
  }, [currentOrganizationId])

  const isLoading = loadedFor !== currentOrganizationId

  return (
    <div className="space-y-8">
      <PageHeader title="Check-in" description="Scan tickets and manage attendance" />

      <section aria-labelledby="today-heading">
        <h2 id="today-heading" className="mb-2 font-display text-[17px] font-semibold tracking-[-0.01em]">Today&apos;s events</h2>
        {isLoading ? (
          <ListSkeleton />
        ) : today.length > 0 ? (
          <EventList events={today} primary />
        ) : (
          <EmptyState
            icon={QrCode}
            title="No events to check in today"
            description="Events happening today appear here with check-in options."
          >
            <Link href="/admin/org/events" className={buttonVariants({ variant: "outline" })}>
              <Calendar /> View events
            </Link>
          </EmptyState>
        )}
      </section>

      {(isLoading || upcoming.length > 0) && (
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="mb-2 font-display text-[17px] font-semibold tracking-[-0.01em]">Coming up</h2>
          {isLoading ? <ListSkeleton /> : <EventList events={upcoming} />}
        </section>
      )}
    </div>
  )
}

function EventList({ events, primary = false }: { events: HubEvent[]; primary?: boolean }) {
  return (
    <ul className={cn("divide-y divide-rule overflow-hidden rounded-xl border", primary && "border-foreground/25")}>
      {events.map((e) => (
        <li key={e.id} className={cn("flex items-center gap-4 px-4", primary ? "py-4 max-sm:flex-wrap" : "py-3.5")}>
          <DateBlock date={e.startDate} timeZone={e.timezone} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link href={`/admin/org/events/${e.id}`} className={cn("truncate font-medium hover:underline hover:underline-offset-4", primary ? "font-display text-lg font-semibold tracking-[-0.015em]" : "text-[15px]")}>
                {e.title}
              </Link>
              <Pill tone={statusTone(e.status)} className="shrink-0 max-sm:hidden">{statusLabel(e.status)}</Pill>
            </div>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {[primary ? fmtTime(e.startDate, e.timezone) : `${fmtDay(e.startDate, e.timezone)}, ${fmtTime(e.startDate, e.timezone)}`, e.isOnline ? "Online" : e.venue].filter(Boolean).join(" · ")}
              <ZoneNote timeZone={e.timezone} at={e.startDate} className="before:content-['_·_']" />
            </p>
            <Registered count={e.currentRegistrations || 0} capacity={e.maxCapacity} suffix="registered" className="mt-2 max-w-48 sm:hidden" />
          </div>
          <Registered count={e.currentRegistrations || 0} capacity={e.maxCapacity} suffix="registered" className="hidden w-40 shrink-0 sm:block" />
          <Link
            href={`/admin/org/events/${e.id}/check-in`}
            className={cn(buttonVariants({ variant: primary ? "default" : "outline", size: primary ? "lg" : "sm" }), "shrink-0", primary && "h-11 px-5 font-semibold max-sm:w-full pointer-coarse:h-12")}
          >
            <QrCode /> <span className={primary ? undefined : "max-sm:sr-only"}>Check in</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-rule rounded-xl border px-4" aria-busy="true" aria-label="Loading events">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-4 py-3.5">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  )
}

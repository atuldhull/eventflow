"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ArrowRight, MapPin, Monitor, Ticket } from "lucide-react"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pill } from "@/components/ui/pill"
import { EmptyState } from "@/components/shared/EmptyState"
import { cn } from "@/lib/utils"

interface DashboardData {
  stats: { registrations: number; activeTickets: number; certificates: number; totalSpent: number }
  upcomingEvents: { registrationId: string; status: string; id: string; title: string; slug: string; startDate: string; venue: string | null; venueCity: string | null; isOnline: boolean; category: string; organization: { name: string } }[]
}

type Upcoming = DashboardData["upcomingEvents"][number]

function countdownFor(startDate: string) {
  const diffMs = new Date(startDate).getTime() - Date.now()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const label =
    diffMs <= 0 ? "Happening now" :
    diffHours < 1 ? "Starting soon" :
    diffHours < 24 ? `in ${diffHours}h` :
    diffDays === 1 ? "Tomorrow" :
    diffDays < 7 ? `in ${diffDays} days` :
    diffDays < 30 ? `in ${Math.round(diffDays / 7)} week${Math.round(diffDays / 7) === 1 ? "" : "s"}` :
    `in ${Math.round(diffDays / 30)} month${Math.round(diffDays / 30) === 1 ? "" : "s"}`
  return { label, soon: diffDays < 3 }
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`
const where = (e: Upcoming) => (e.isOnline ? "Online" : e.venue || e.venueCity || "Venue to be announced")

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/users/me/dashboard")
        const json = await res.json()
        if (json.success) setData(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchDashboard()
  }, [])

  const stats = data?.stats || { registrations: 0, activeTickets: 0, certificates: 0, totalSpent: 0 }
  const upcoming = data?.upcomingEvents ?? []
  const [next, ...later] = upcoming
  const firstName = session?.user?.name?.split(" ")[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.015em]">{firstName ? `Hi, ${firstName}` : "Your events"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Loading your events…" : upcoming.length === 0 ? "Nothing coming up yet." : `${upcoming.length} upcoming event${upcoming.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "max-sm:w-full")}>Browse events</Link>
      </div>

      {/* Next up: the screen's one question, answered first */}
      {isLoading ? (
        <Card className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-3 h-7 w-2/3" /><Skeleton className="mt-3 h-4 w-1/2" /></Card>
      ) : next ? (
        <NextUp event={next} />
      ) : (
        <EmptyState
          variant="page"
          icon={Ticket}
          title="You're not registered for anything yet"
          description="Find an event at your college or company and your ticket will show up here."
        >
          <Link href="/events" className={buttonVariants()}>Browse events</Link>
        </EmptyState>
      )}

      {/* Your numbers, one divided strip; each figure opens its section */}
      <Card className="gap-0 overflow-hidden p-0">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/dashboard/events", label: "Events registered", value: stats.registrations.toLocaleString("en-IN") },
            { href: "/dashboard/tickets", label: "Active tickets", value: stats.activeTickets.toLocaleString("en-IN") },
            { href: "/dashboard/certificates", label: "Certificates", value: stats.certificates.toLocaleString("en-IN") },
            { href: "/dashboard/payments", label: "Total spent", value: inr(stats.totalSpent) },
          ].map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className={cn(
                "group block px-5 py-4 transition-colors hover:bg-muted/60",
                i % 2 === 1 && "border-l",
                i >= 2 && "max-lg:border-t",
                i === 2 && "lg:border-l",
              )}
            >
              <dt className="flex items-center justify-between text-sm text-muted-foreground">
                {s.label}
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </dt>
              <dd className="mt-1.5 text-[26px] leading-8 tracking-[-0.02em] tabular-nums">
                {isLoading ? <Skeleton className="h-7 w-16" /> : s.value}
              </dd>
            </Link>
          ))}
        </dl>
      </Card>

      {/* Everything after the next one */}
      {!isLoading && later.length > 0 && (
        <section aria-labelledby="later-heading">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="later-heading" className="text-[15px] font-semibold">Later</h2>
            <Link href="/dashboard/events" className="text-sm text-muted-foreground hover:text-foreground">All my events</Link>
          </div>
          <Card className="gap-0 p-0">
            <ul className="divide-y divide-rule">
              {later.map((event) => {
                const start = new Date(event.startDate)
                const { label, soon } = countdownFor(event.startDate)
                return (
                  <li key={event.registrationId}>
                    <Link href={`/events/${event.slug}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/60">
                      <DateTile date={start} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{event.title}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
                          {event.isOnline ? <Monitor className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
                          <span className="truncate">{where(event)}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0 tabular-nums">{start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                        </p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        <Pill tone="neutral">{event.category}</Pill>
                      </div>
                      <span className={cn("shrink-0 text-[13px] tabular-nums", soon ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      )}
    </div>
  )
}

function NextUp({ event }: { event: Upcoming }) {
  const start = new Date(event.startDate)
  const { label } = countdownFor(event.startDate)
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-col sm:flex-row">
        <div className="flex items-center gap-4 border-b bg-frame px-5 py-4 sm:w-44 sm:flex-col sm:items-start sm:justify-center sm:border-r sm:border-b-0">
          <div>
            <p className="text-sm text-muted-foreground">{start.toLocaleDateString("en-IN", { weekday: "long" })}</p>
            <p className="text-[28px] leading-8 font-semibold tracking-[-0.02em] tabular-nums">
              {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </p>
          </div>
          <p className="ml-auto text-sm font-medium text-brand sm:ml-0">{label}</p>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Next up · {event.organization.name}</p>
            <Link href={`/events/${event.slug}`} className="mt-1 block text-lg leading-snug font-semibold hover:underline hover:underline-offset-4">
              {event.title}
            </Link>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular-nums">{start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
              <span className="flex items-center gap-1.5">
                {event.isOnline ? <Monitor className="size-3.5" /> : <MapPin className="size-3.5" />}
                {where(event)}
              </span>
              <Pill tone="neutral">{event.category}</Pill>
            </p>
          </div>
          <Link href="/dashboard/tickets" className={cn(buttonVariants(), "shrink-0 gap-2 max-sm:w-full")}>
            <Ticket className="size-4" /> Show ticket
          </Link>
        </div>
      </div>
    </Card>
  )
}

function DateTile({ date }: { date: Date }) {
  return (
    <div className="flex w-11 shrink-0 flex-col items-center rounded-md bg-muted py-1 leading-none" aria-hidden>
      <span className="text-[11px] text-muted-foreground">{date.toLocaleDateString("en-IN", { month: "short" })}</span>
      <span className="mt-0.5 text-[17px] font-semibold tabular-nums">{date.getDate()}</span>
    </div>
  )
}

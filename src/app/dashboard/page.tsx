"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, MapPin, Monitor, Ticket } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pill } from "@/components/ui/pill"
import { CountUp } from "@/components/marketing/fx"
import { DashEmpty, DateBlock } from "./_components/bits"
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
const timeOf = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })

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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[30px] leading-9 font-bold tracking-[-0.035em]">
            {firstName ? (
              <>
                Hi,{" "}
                <span className="relative z-0 inline-block px-[0.18em] pb-[0.04em]">
                  <span aria-hidden className="absolute -inset-x-[0.02em] top-[0.08em] -bottom-[0.02em] -z-10 -rotate-[1.5deg] rounded-[0.18em] bg-lemon" />
                  <span className="text-lemon-ink">{firstName}</span>
                </span>
              </>
            ) : (
              "Your events"
            )}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isLoading ? "Loading your events…" : upcoming.length === 0 ? "Nothing coming up yet." : `${upcoming.length} upcoming event${upcoming.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link href="/events" className={cn(buttonVariants({ variant: "outline" }), "max-sm:w-full")}>
          Browse events <ArrowUpRight className="size-4" />
        </Link>
      </div>

      {/* Next up: the screen's one question, answered first, as a real ticket stub */}
      {isLoading ? (
        <div className="flex overflow-hidden rounded-xl border bg-card">
          <div className="hidden w-52 border-r p-6 sm:block"><Skeleton className="h-4 w-16" /><Skeleton className="mt-3 h-14 w-24" /></div>
          <div className="flex-1 p-6"><Skeleton className="h-4 w-32" /><Skeleton className="mt-3 h-8 w-2/3" /><Skeleton className="mt-3 h-4 w-1/2" /></div>
        </div>
      ) : next ? (
        <NextUp event={next} />
      ) : (
        <DashEmpty
          title="Your calendar is wide open"
          description="Find an event at your college or company. Once you register, your ticket shows up right here."
        >
          <Link href="/events" className={buttonVariants()}>Browse events</Link>
          <Link href="/dashboard/saved" className={buttonVariants({ variant: "ghost" })}>See saved events</Link>
        </DashEmpty>
      )}

      {/* Your numbers, one divided strip; each figure opens its section */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/dashboard/events", label: "Events registered", value: stats.registrations },
            { href: "/dashboard/tickets", label: "Active tickets", value: stats.activeTickets },
            { href: "/dashboard/certificates", label: "Certificates", value: stats.certificates },
            { href: "/dashboard/payments", label: "Total spent", value: stats.totalSpent, money: true },
          ].map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className={cn(
                "group block px-5 py-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:py-5",
                i % 2 === 1 && "border-l",
                i >= 2 && "max-lg:border-t",
                i === 2 && "lg:border-l",
              )}
            >
              <dt className="flex items-center justify-between text-[13px] text-muted-foreground">
                {s.label}
                <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
              </dt>
              <dd className="font-display mt-2 text-[30px] leading-9 font-bold tracking-[-0.04em] tabular-nums sm:text-[34px]">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <span aria-hidden>{s.money && "₹"}<CountUp value={s.value} /></span>
                )}
                {!isLoading && <span className="sr-only">{s.money ? inr(s.value) : s.value.toLocaleString("en-IN")}</span>}
              </dd>
            </Link>
          ))}
        </dl>
      </div>

      {/* Everything after the next one, as a short timeline */}
      {!isLoading && later.length > 0 && (
        <section aria-labelledby="later-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="later-heading" className="font-display text-[19px] font-bold tracking-[-0.02em]">Later</h2>
            <Link href="/dashboard/events" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:min-h-0">
              All my events <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <ol className="relative">
            {/* the timeline spine, threaded behind the date blocks */}
            <span aria-hidden className="absolute top-4 bottom-4 left-6 w-px bg-border" />
            {later.map((event) => {
              const start = new Date(event.startDate)
              const { label, soon } = countdownFor(event.startDate)
              return (
                <li key={event.registrationId} className="relative">
                  <Link href={`/events/${event.slug}`} className="group flex items-center gap-4 rounded-xl py-2.5 pr-3 transition-colors hover:bg-muted/60">
                    <DateBlock date={start} className="relative bg-card" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium group-hover:underline group-hover:underline-offset-4">{event.title}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
                        {event.isOnline ? <Monitor className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
                        <span className="truncate">{where(event)}</span>
                        <span aria-hidden>·</span>
                        <span className="shrink-0 tabular-nums">{timeOf(start)}</span>
                      </p>
                    </div>
                    <div className="hidden shrink-0 sm:block">
                      <Pill tone="neutral">{event.category}</Pill>
                    </div>
                    <span className={cn("w-20 shrink-0 text-right text-[13px] tabular-nums", soon ? "font-medium text-brand" : "text-muted-foreground")}>{label}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}

function NextUp({ event }: { event: Upcoming }) {
  const start = new Date(event.startDate)
  const { label } = countdownFor(event.startDate)
  return (
    <article aria-label={`Next up: ${event.title}`} className="relative flex flex-col overflow-hidden rounded-xl border bg-card sm:flex-row">
      {/* the stub: date set big */}
      <div className="flex items-end justify-between gap-4 bg-frame px-6 py-5 sm:w-56 sm:flex-col sm:items-start sm:justify-between sm:py-6">
        <div className="leading-none">
          <p className="text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
            {start.toLocaleDateString("en-IN", { weekday: "long" })}
          </p>
          <p className="mt-2 flex items-end gap-2">
            <span className="font-display text-[64px] leading-[0.85] font-extrabold tracking-[-0.06em] tabular-nums sm:text-[76px]">{start.getDate()}</span>
            <span className="font-display mb-1 text-[22px] font-bold tracking-[-0.03em]">{start.toLocaleDateString("en-IN", { month: "short" })}</span>
          </p>
        </div>
        <p className="text-right sm:text-left">
          <span className="block text-[12px] text-muted-foreground">Starts</span>
          <span className="font-display text-[19px] font-bold tracking-[-0.02em] text-brand">{label}</span>
        </p>
      </div>

      {/* the perforation, with notches cut where it meets the edge */}
      <div aria-hidden className="relative border-t-2 border-dashed sm:border-t-0 sm:border-l-2">
        <span className="absolute -top-[11px] -left-2.5 size-5 rounded-full border bg-background sm:-left-[11px]" />
        <span className="absolute -top-[11px] -right-2.5 size-5 rounded-full border bg-background sm:top-auto sm:right-auto sm:-bottom-[11px] sm:-left-[11px]" />
      </div>

      <div className="flex flex-1 flex-col gap-5 p-6 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">Next up</span> · {event.organization.name}
          </p>
          <Link
            href={`/events/${event.slug}`}
            className="font-display mt-1.5 block text-[24px] leading-[1.15] font-bold tracking-[-0.03em] hover:underline hover:underline-offset-4 sm:text-[28px]"
          >
            {event.title}
          </Link>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="tabular-nums">{timeOf(start)}</span>
            <span className="flex items-center gap-1.5">
              {event.isOnline ? <Monitor className="size-3.5" /> : <MapPin className="size-3.5" />}
              {where(event)}
            </span>
            <Pill tone="neutral">{event.category}</Pill>
          </p>
        </div>
        <Link
          href="/dashboard/tickets"
          className="group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-lemon px-5 text-[15px] font-semibold text-lemon-ink ring-1 ring-black/10 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_var(--lemon)] focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:outline-none active:translate-y-0 max-lg:w-full motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <Ticket className="size-4" /> Show ticket
        </Link>
      </div>
    </article>
  )
}

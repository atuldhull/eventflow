"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Calendar, MapPin, Monitor, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { DashEmpty, DateBlock } from "../_components/bits"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { eventTimeframe } from "@/lib/event-timeframe"
import { completePaymentHref } from "@/components/tickets/HeldRegistrations"

/** One registration from /api/users/me/registrations: every status, with or without a ticket. */
interface MyRegistration {
  id: string
  registrationNumber: string
  status: string
  /** status, with PENDING split into PENDING_PAYMENT and PENDING_APPROVAL */
  displayStatus: string
  holdExpiresAt: string | null
  waitlistPosition: number | null
  ticketType: string
  ticket: { id: string; status: string; ticketNumber: string } | null
  event: {
    id: string
    title: string
    slug: string
    startDate: string
    endDate: string
    venue: string | null
    venueCity: string | null
    isOnline: boolean
    category: string | null
    organization: { name: string } | null
  }
}

// Statuses the attendee can still cancel (before the event starts).
const CANCELLABLE = ["PENDING", "CONFIRMED", "WAITLISTED"]

/** "November 2026" groups, in the order the list is already sorted. */
function groupByMonth(list: MyRegistration[]) {
  const groups = new Map<string, MyRegistration[]>()
  for (const reg of list) {
    const key = new Date(reg.event.startDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    groups.set(key, [...(groups.get(key) ?? []), reg])
  }
  return [...groups.entries()]
}

function pillFor(displayStatus: string) {
  if (displayStatus === "PENDING_PAYMENT") return { tone: statusTone("pending"), label: "Pending payment" }
  return { tone: statusTone(displayStatus), label: statusLabel(displayStatus) }
}

export default function MyEventsPage() {
  const [registrations, setRegistrations] = useState<MyRegistration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState("upcoming")
  const [toCancel, setToCancel] = useState<MyRegistration | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    async function fetchRegistrations() {
      try {
        const res = await fetch("/api/users/me/registrations")
        const json = await res.json()
        if (json.success) setRegistrations(json.data || [])
        else toast.error(json.message || "Failed to load your events")
      } catch {
        toast.error("Failed to load your events")
      } finally {
        setIsLoading(false)
      }
    }
    fetchRegistrations()
  }, [])

  // Same request as before (it takes the registration id); a confirm dialog guards it.
  const cancelRegistration = async () => {
    if (!toCancel) return
    const reg = toCancel
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/registrations/${reg.id}/cancel`, { method: "POST" })
      const json = await res.json()
      if (json.success) {
        toast.success("Registration cancelled")
        // the row stays, now marked cancelled
        setRegistrations((prev) =>
          prev.map((r) => (r.id === reg.id ? { ...r, status: "CANCELLED", displayStatus: "CANCELLED", holdExpiresAt: null } : r))
        )
        setToCancel(null)
      } else {
        toast.error(json.message)
      }
    } catch {
      toast.error("Failed to cancel")
    } finally {
      setIsCancelling(false)
    }
  }

  // Upcoming = not ended yet (a running event included); Past = ended; All = everything.
  const now = new Date()
  const byStart = (a: MyRegistration, b: MyRegistration) => +new Date(a.event.startDate) - +new Date(b.event.startDate)
  const upcoming = registrations.filter((r) => eventTimeframe(r.event, now) !== "past").sort(byStart)
  const past = registrations.filter((r) => eventTimeframe(r.event, now) === "past").sort((a, b) => byStart(b, a))
  const all = [...registrations].sort((a, b) => byStart(b, a))
  const displayed = tab === "upcoming" ? upcoming : tab === "past" ? past : all

  return (
    <div className="space-y-6">
      <PageHeader
        title="My events"
        description={isLoading ? "Loading your registrations" : `${registrations.length} registration${registrations.length !== 1 ? "s" : ""}`}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line">
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="all">All ({registrations.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading events">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
        </div>
      ) : displayed.length > 0 ? (
        <div className="space-y-7">
          {groupByMonth(displayed).map(([month, regs]) => (
            <section key={month} aria-label={month}>
              <h2 className="mb-2 flex items-center gap-2.5 text-[13px] text-muted-foreground">
                <span className="font-display text-[17px] font-bold tracking-[-0.02em] text-foreground">{month.split(" ")[0]}</span>
                <span className="tabular-nums">{month.split(" ")[1]}</span>
                <span aria-hidden className="h-px flex-1 bg-rule" />
                <span className="tabular-nums">{regs.length}</span>
              </h2>
              <ul className="divide-y divide-rule overflow-hidden rounded-xl border bg-card">
                {regs.map((reg) => {
                  const { event } = reg
                  const start = new Date(event.startDate)
                  const live = eventTimeframe(event, now) === "live"
                  const canCancel = CANCELLABLE.includes(reg.status) && start > now
                  const pill = pillFor(reg.displayStatus)
                  const held = reg.displayStatus === "PENDING_PAYMENT"
                  const note =
                    reg.displayStatus === "PENDING_PAYMENT" && reg.holdExpiresAt
                      ? `Seat held until ${new Date(reg.holdExpiresAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
                      : reg.status === "WAITLISTED" && reg.waitlistPosition
                        ? `Waitlist #${reg.waitlistPosition}`
                        : null
                  return (
                    <li
                      key={reg.id}
                      className="group relative flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:flex-nowrap"
                    >
                      <DateBlock date={start} className={cn(live && "border-brand/50 bg-brand/10")} />
                      <div className="min-w-0 flex-1">
                        {/* stretched link: the whole row opens the event, the buttons sit above it */}
                        <Link
                          href={`/events/${event.slug}`}
                          className="block truncate text-[15px] font-medium after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:underline-offset-4"
                        >
                          {event.title}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
                          <span className={cn("inline-flex items-center gap-1", live && "font-medium text-brand")}>
                            <Calendar className="size-3.5" />
                            {live ? "Happening now" : start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            {event.isOnline ? <Monitor className="size-3.5" /> : <MapPin className="size-3.5" />}
                            {event.isOnline ? "Online" : (event.venue || event.venueCity || "TBA")}
                          </span>
                          <span>{event.organization?.name ?? "—"}</span>
                          {note && <span className={cn(held && "font-medium text-foreground")}>{note}</span>}
                        </p>
                      </div>
                      <div className="flex w-full shrink-0 items-center gap-3 pl-16 sm:w-auto sm:pl-0">
                        <span className="text-[13px] text-muted-foreground">{reg.ticketType}</span>
                        <Pill tone={pill.tone}>{pill.label}</Pill>
                        {(held || canCancel) && (
                          <span className="ml-auto flex items-center gap-1 sm:ml-0">
                            {held && (
                              <Link href={completePaymentHref(reg)} className={buttonVariants({ size: "sm", className: "relative z-10" })}>
                                Complete payment
                              </Link>
                            )}
                            {canCancel && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="relative z-10 text-muted-foreground hover:bg-pill-negative hover:text-destructive"
                                aria-label={held ? `Release held seat for ${event.title}` : `Cancel registration for ${event.title}`}
                                title={held ? "Release seat" : "Cancel registration"}
                                onClick={() => setToCancel(reg)}
                              >
                                <XCircle />
                              </Button>
                            )}
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <DashEmpty
          title={tab === "past" ? "No past events yet" : tab === "upcoming" ? "Nothing on the calendar" : "No events yet"}
          description={`No ${tab === "all" ? "" : tab + " "}events. Events you register for will appear here.`}
        >
          <Link href="/events" className={buttonVariants()}>Browse events</Link>
        </DashEmpty>
      )}

      <Dialog open={!!toCancel} onOpenChange={(open) => !open && !isCancelling && setToCancel(null)}>
        <DialogContent className="sm:max-w-110">
          <DialogHeader>
            <DialogTitle>{toCancel?.displayStatus === "PENDING_PAYMENT" ? "Release your held seat?" : "Cancel this registration?"}</DialogTitle>
            <DialogDescription>
              {toCancel ? `${toCancel.event.title}. ` : ""}
              {toCancel?.displayStatus === "PENDING_PAYMENT"
                ? "The seat goes back to the event; you can register again while seats are left."
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToCancel(null)} disabled={isCancelling}>
              {toCancel?.displayStatus === "PENDING_PAYMENT" ? "Keep my seat" : "Keep registration"}
            </Button>
            <Button variant="destructive" onClick={cancelRegistration} disabled={isCancelling}>
              {isCancelling && <Loader2 className="animate-spin" />}
              {toCancel?.displayStatus === "PENDING_PAYMENT" ? "Release seat" : "Cancel registration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

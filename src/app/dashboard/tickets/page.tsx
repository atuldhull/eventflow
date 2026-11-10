"use client"

import { useState, useEffect, useSyncExternalStore } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { CalendarPlus, Download, Loader2, Maximize, Send, ShieldCheck, WifiOff, X, XCircle } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { DashEmpty } from "../_components/bits"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { TicketCard } from "@/components/tickets/TicketCard"
import { FullScreenQR } from "@/components/tickets/FullScreenQR"
import { HeldRegistrations, type HeldRegistration } from "@/components/tickets/HeldRegistrations"
import { eventTimeframe } from "@/lib/event-timeframe"
import { clearOfflineTickets, isNetworkError, loadOfflineTickets, saveOfflineTickets } from "@/lib/offline-tickets"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface TicketData {
  id: string
  ticketNumber: string
  qrCode: string
  status: string
  event: {
    title: string
    slug: string
    startDate: string
    endDate: string
    venue?: string | null
    venueCity?: string | null
    isOnline: boolean
    type?: string | null
    coverImage?: string | null
    organization?: { name: string } | null
  }
  ticketType: { name: string; price: number; currency: string }
  registration: { id: string; registrationNumber: string; status: string }
  checkIns?: { checkedInAt: Date }[]
}

// Registrations the attendee can still cancel, before the event starts.
const CANCELLABLE = ["PENDING", "CONFIRMED", "WAITLISTED"]
const canCancel = (t: TicketData, now = new Date()) =>
  t.status === "ACTIVE" && CANCELLABLE.includes(t.registration.status) && new Date(t.event.startDate) > now

// "today, 4:05 pm" / "12 Nov, 9:30 am"
function formatUpdatedAt(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "earlier"
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay ? `today, ${time}` : `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`
}

function subscribeToNetworkStatus(onChange: () => void) {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

export default function TicketsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const userId = session?.user?.id
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Showing the copy saved on this device because the server couldn't be reached
  const [fromDevice, setFromDevice] = useState(false)
  // When the tickets shown were last loaded from the server (ISO)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null)
  const [showFullScreenQR, setShowFullScreenQR] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState("")
  const [isTransferring, setIsTransferring] = useState(false)
  const [tab, setTab] = useState("upcoming")
  // Paid registrations holding a seat while payment is pending: no ticket yet
  const [held, setHeld] = useState<HeldRegistration[]>([])
  const [cancelOpen, setCancelOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  // Node 21+ has a global `navigator` without `onLine`, so reading it during render made the
  // server think it was offline. The server snapshot is "online"; the browser value follows hydration.
  const isOffline = useSyncExternalStore(subscribeToNetworkStatus, () => !navigator.onLine, () => false)

  // Every ticket once; the tabs are views of the same list, so their counts always agree.
  // Offline the session can't be fetched either, so this also runs signed-out-looking:
  // the server answers 401 when really signed out, and a network error means offline.
  useEffect(() => {
    if (sessionStatus === "loading") return
    let cancelled = false
    const showDeviceCopy = () => {
      const saved = loadOfflineTickets(userId)
      setTickets((saved?.tickets ?? []) as unknown as TicketData[])
      setUpdatedAt(saved?.savedAt ?? null)
      setFromDevice(true)
    }
    async function fetchTickets() {
      try {
        const res = await fetch("/api/users/me/tickets")
        if (cancelled) return
        if (res.status === 401) {
          clearOfflineTickets()
          setTickets([])
          setUpdatedAt(null)
          return
        }
        const data = await res.json()
        if (cancelled) return
        if (data.success) {
          const list: TicketData[] = data.data || []
          setTickets(list)
          setFromDevice(false)
          setUpdatedAt(new Date().toISOString())
        } else if (res.status === 503 || !navigator.onLine) {
          showDeviceCopy()
        } else {
          toast.error(data.message || "Failed to load tickets")
        }
      } catch (error) {
        if (cancelled) return
        if (isNetworkError(error) || !navigator.onLine) {
          showDeviceCopy()
        } else {
          toast.error("Failed to load tickets")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    async function fetchHeld() {
      try {
        const res = await fetch("/api/users/me/registrations")
        const json = await res.json()
        if (json.success) {
          setHeld((json.data || []).filter((r: { displayStatus: string; ticket: unknown }) => r.displayStatus === "PENDING_PAYMENT" && !r.ticket))
        }
      } catch {}
    }
    fetchTickets()
    if (userId) fetchHeld()
    return () => {
      cancelled = true
    }
    // isOffline: reload when the connection comes back (and fall back to the copy when it drops)
  }, [sessionStatus, userId, isOffline])

  // Keep the device copy in step with what the server returned, including a cancel or a
  // transfer made here (the copy shown offline is never written back).
  useEffect(() => {
    if (!isLoading && !fromDevice && userId && updatedAt) saveOfflineTickets(userId, tickets, new Date(updatedAt))
  }, [tickets, isLoading, fromDevice, userId, updatedAt])

  // Same request as "My events" uses; the ticket becomes void with the registration.
  const cancelRegistration = async () => {
    if (!selectedTicket) return
    const ticket = selectedTicket
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/registrations/${ticket.registration.id}/cancel`, { method: "POST" })
      const json = await res.json()
      if (json.success) {
        toast.success("Registration cancelled")
        setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, status: "CANCELLED", registration: { ...t.registration, status: "CANCELLED" } } : t)))
        setCancelOpen(false)
        setSelectedTicket(null)
      } else {
        toast.error(json.message)
      }
    } catch {
      toast.error("Failed to cancel")
    } finally {
      setIsCancelling(false)
    }
  }

  const handleDownload = async (ticketId: string) => {
    window.open(`/api/tickets/${ticketId}/download`, "_blank")
  }

  const openTransfer = () => {
    setRecipientEmail("")
    setTransferOpen(true)
  }

  // Same request as before (POST /api/tickets/:id/transfer { recipientEmail }); a form replaces window.prompt().
  const handleTransfer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = recipientEmail.trim()
    if (!selectedTicket || !email) return
    setIsTransferring(true)
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: email }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
        // the ticket now belongs to the recipient
        setTickets((prev) => prev.filter((t) => t.id !== selectedTicket.id))
        setTransferOpen(false)
        setSelectedTicket(null)
      } else {
        toast.error(json.message)
      }
    } catch {
      toast.error("Transfer failed. Please try again.")
    } finally {
      setIsTransferring(false)
    }
  }

  // Upcoming = the event hasn't ended: a running event's ticket is listed first, as
  // happening now (checked in or not). Past = the event has ended. All = every ticket.
  const now = new Date()
  const admits = (t: TicketData) => t.status === "ACTIVE" || t.status === "USED"
  const liveTickets = tickets.filter((t) => admits(t) && eventTimeframe(t.event, now) === "live")
  const laterTickets = tickets.filter((t) => admits(t) && eventTimeframe(t.event, now) === "upcoming")
  const upcomingCount = liveTickets.length + laterTickets.length
  const pastTickets = tickets.filter((t) => eventTimeframe(t.event, now) === "past").reverse()

  const renderList = (list: TicketData[], empty: React.ReactNode) => {
    if (isLoading) {
      return (
        <div className="grid gap-4 xl:grid-cols-2" aria-busy="true" aria-label="Loading tickets">
          <Skeleton className="h-[116px] rounded-lg" />
          <Skeleton className="h-[116px] rounded-lg" />
        </div>
      )
    }
    if (list.length === 0) return empty
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {list.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onViewTicket={() => setSelectedTicket(ticket)}
            onDownload={() => handleDownload(ticket.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets"
        description={`${liveTickets.length > 0 ? `${liveTickets.length} happening now · ` : ""}${laterTickets.length} upcoming · open a ticket to show its QR code at the entrance`}
      />

      {/* the wallet's status line: what's ready, and whether this device keeps a copy */}
      {!isLoading && !isOffline && !fromDevice && tickets.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-3 text-[13px] text-muted-foreground">
          <span className="flex items-baseline gap-2">
            <span className="font-display text-[22px] leading-none font-bold tracking-[-0.03em] text-foreground tabular-nums">{upcomingCount}</span>
            ready to show at the door
          </span>
          {userId && updatedAt && (
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-brand" aria-hidden />
              Saved on this device for offline use · updated {formatUpdatedAt(updatedAt)}
            </span>
          )}
        </div>
      )}

      {(isOffline || fromDevice) && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl bg-pill-warning p-3.5 text-sm text-pill-warning-foreground">
          <WifiOff className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">You&apos;re offline. Showing tickets saved on this device.</p>
            {isLoading ? null : updatedAt ? (
              <p className="text-[13px]">
                Last updated {formatUpdatedAt(updatedAt)}. Your QR codes still work at venue check-in.
              </p>
            ) : (
              <p className="text-[13px]">No tickets are saved on this device yet. Open this page once while online to keep them for offline use.</p>
            )}
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line">
          <TabsTrigger value="upcoming">Upcoming ({upcomingCount})</TabsTrigger>
          <TabsTrigger value="past">Past ({pastTickets.length})</TabsTrigger>
          <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-5 space-y-6">
          <HeldRegistrations items={held} onReleased={(id) => setHeld((prev) => prev.filter((r) => r.id !== id))} />
          {!isLoading && liveTickets.length > 0 ? (
            <div className="space-y-6">
              <section aria-labelledby="tickets-live-heading" className="space-y-3">
                <h2 id="tickets-live-heading" className="flex items-center gap-2 font-display text-[19px] font-bold tracking-[-0.02em]">
                  <span aria-hidden className="relative flex size-2.5">
                    <span className="fx-ping absolute inline-flex size-full rounded-full bg-brand" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
                  </span>
                  Happening now
                </h2>
                {renderList(liveTickets, null)}
              </section>
              {laterTickets.length > 0 && (
                <section aria-labelledby="tickets-later-heading" className="space-y-3">
                  <h2 id="tickets-later-heading" className="font-display text-[19px] font-bold tracking-[-0.02em]">Coming up</h2>
                  {renderList(laterTickets, null)}
                </section>
              )}
            </div>
          ) : (
            renderList(
              laterTickets,
              <DashEmpty title="Your wallet is empty" description="No upcoming tickets. Register for an event and its ticket lands here, ready for the door.">
                <Link href="/events" className={buttonVariants()}>Browse events</Link>
              </DashEmpty>
            )
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-5">
          {renderList(
            pastTickets,
            <DashEmpty title="No past tickets" description="Your attended events will appear here." />
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-5">
          {renderList(
            tickets,
            <DashEmpty title="No tickets yet" description="Tickets for events you register for are kept here.">
              <Link href="/events" className={buttonVariants()}>Browse events</Link>
            </DashEmpty>
          )}
        </TabsContent>
      </Tabs>

      {/* The opened ticket: a centred dialog on desktop, a bottom sheet on phones (dialog primitive handles both) */}
      <Dialog
        open={!!selectedTicket && !showFullScreenQR && !transferOpen && !cancelOpen}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[400px]" showCloseButton={false}>
          {selectedTicket && (
            <>
              <DialogTitle className="sr-only">{selectedTicket.event.title} ticket</DialogTitle>
              {/* the dialog is the card here: drop the ticket's own radius and fill so no edge shows in dark mode */}
              <div className="[&>div]:rounded-none [&>div]:bg-transparent">
                <TicketCard ticket={selectedTicket} variant="full" />
              </div>
              <div className="grid grid-cols-2 gap-2 px-6 pt-5 pb-6">
                <Button className="col-span-2" onClick={() => setShowFullScreenQR(true)}>
                  <Maximize /> Full screen QR
                </Button>
                <Button variant="outline" onClick={() => handleDownload(selectedTicket.id)}>
                  <Download /> Download PDF
                </Button>
                <Button variant="outline" onClick={() => window.open(`/api/tickets/${selectedTicket.id}/calendar`, "_blank")}>
                  <CalendarPlus /> Add to calendar
                </Button>
                <Button variant="outline" className="col-span-2" onClick={openTransfer}>
                  <Send /> Transfer
                </Button>
                {canCancel(selectedTicket) && (
                  <Button
                    variant="ghost"
                    className="col-span-2 text-muted-foreground hover:bg-pill-negative hover:text-destructive"
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle /> Cancel registration
                  </Button>
                )}
              </div>
              {/* sits on the white QR paper in both themes, so the icon is always navy */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => setSelectedTicket(null)}
                className="absolute top-2 right-2 text-[#171717] hover:bg-[#eceff3] hover:text-[#171717] dark:hover:bg-[#eceff3]"
              >
                <X className="size-[18px]" />
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer: replaces the old window.prompt() with a proper form */}
      <Dialog open={transferOpen && !!selectedTicket} onOpenChange={(open) => !open && !isTransferring && setTransferOpen(false)}>
        <DialogContent className="sm:max-w-[440px]">
          <form onSubmit={handleTransfer} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Transfer ticket</DialogTitle>
              <DialogDescription>
                {selectedTicket ? `${selectedTicket.event.title}. ` : ""}The ticket moves to their account and your QR code stops working.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="transfer-email">Recipient email</Label>
              <Input
                id="transfer-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                autoFocus
                placeholder="friend@college.edu"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                aria-describedby="transfer-email-hint"
              />
              <p id="transfer-email-hint" className="text-xs text-muted-foreground">
                No account yet? We create one for this email.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)} disabled={isTransferring}>
                Cancel
              </Button>
              <Button type="submit" disabled={isTransferring || !recipientEmail.trim()}>
                {isTransferring && <Loader2 className="animate-spin" />}
                Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel from the opened ticket, confirmed first */}
      <Dialog open={cancelOpen && !!selectedTicket} onOpenChange={(open) => !open && !isCancelling && setCancelOpen(false)}>
        <DialogContent className="sm:max-w-110">
          <DialogHeader>
            <DialogTitle>Cancel this registration?</DialogTitle>
            <DialogDescription>
              {selectedTicket ? `${selectedTicket.event.title}. ` : ""}Your ticket stops working and this cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={isCancelling}>Keep registration</Button>
            <Button variant="destructive" onClick={cancelRegistration} disabled={isCancelling}>
              {isCancelling && <Loader2 className="animate-spin" />}
              Cancel registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Screen QR */}
      {showFullScreenQR && selectedTicket && (
        <FullScreenQR
          qrData={selectedTicket.qrCode}
          ticketNumber={selectedTicket.ticketNumber}
          eventTitle={selectedTicket.event.title}
          onClose={() => setShowFullScreenQR(false)}
        />
      )}
    </div>
  )
}

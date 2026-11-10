"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatInZone } from "@/lib/event-time"
import { useEventZoneNote } from "@/hooks/useViewerTimeZone"

/*
 * Presentation helpers shared by the organizer event screens. No data logic. Pass the
 * event's time zone (Event.timezone) so times read as the event's clock, not the browser's.
 */

export const fmtDay = (d: string | Date, timeZone?: string | null) =>
  formatInZone(d, timeZone, { weekday: "short", day: "numeric", month: "short" })

export const fmtDate = (d: string | Date, timeZone?: string | null) =>
  formatInZone(d, timeZone, { day: "numeric", month: "short", year: "numeric" })

export const fmtTime = (d: string | Date, timeZone?: string | null) =>
  formatInZone(d, timeZone, { hour: "numeric", minute: "2-digit" })

/** The enterprise's reject decision, sent by the org events APIs while the event is the draft it was sent back as. */
export interface ApprovalRejection {
  reason: string | null
  decidedAt: string
  decidedByName: string | null
  enterpriseName: string | null
}

/** "Rejected by Acme: <reason>" */
export const rejectionLine = (r: ApprovalRejection) =>
  `Rejected by ${r.enterpriseName || "your enterprise"}${r.reason ? `: ${r.reason}` : ""}`

/** "· IST (Asia/Kolkata)" style label, only when the event's zone isn't the viewer's. */
export function ZoneNote({ timeZone, at, className }: { timeZone?: string | null; at?: string | Date; className?: string }) {
  const note = useEventZoneNote(timeZone, at)
  return note ? <span className={cn("text-muted-foreground", className)} title="Times are shown in the event's time zone">{note}</span> : null
}

/** "TEAM_BUILDING" -> "Team building"; plain words pass through. */
export function enumLabel(value: string | null | undefined) {
  if (!value) return "—"
  const words = value.replace(/_/g, " ").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`

/** The thin teal fill that shows how full something is. */
export function CapacityBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={`${value} of ${max}`}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** "212 / 300" with a bar, or "212" alone when there is no cap. */
export function Registered({ count, capacity, suffix, className }: { count: number; capacity: number | null | undefined; suffix?: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-sm tabular-nums">
        {count.toLocaleString("en-IN")}
        {capacity ? <span className="text-muted-foreground"> / {capacity.toLocaleString("en-IN")}</span> : null}
        {suffix && <span className="text-muted-foreground"> {suffix}</span>}
      </p>
      {capacity ? <CapacityBar value={count} max={capacity} className="mt-1.5" /> : null}
    </div>
  )
}

/** Month over day, for event rows. */
export function DateBlock({ date, timeZone, className }: { date: string | Date; timeZone?: string | null; className?: string }) {
  return (
    <div className={cn("flex w-10 shrink-0 flex-col items-center leading-none", className)} aria-hidden>
      <span className="text-[11px] text-muted-foreground">{formatInZone(date, timeZone, { month: "short" })}</span>
      <span className="mt-1 text-lg font-semibold tabular-nums">{formatInZone(date, timeZone, { day: "2-digit" })}</span>
    </div>
  )
}

/** A label / value pair inside a facts list. */
export function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("py-3 first:pt-0 last:pb-0", className)}>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  )
}

/**
 * Cancel an event: POST /api/admin/org/:orgId/events/:eventId/cancel { reason, refundPayments }.
 * The API requires a reason, so the dialog asks for one. Paid tickets are refunded unless
 * the organizer unticks the box (for example, to refund by bank transfer themselves).
 */
export function CancelEventDialog({
  orgId,
  event,
  onClose,
  onCancelled,
}: {
  orgId: string | null | undefined
  event: { id: string; title: string } | null
  onClose: () => void
  onCancelled: () => void
}) {
  const [reason, setReason] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)
  const [refundPayments, setRefundPayments] = useState(true)

  const close = () => {
    if (isCancelling) return
    setReason("")
    setRefundPayments(true)
    onClose()
  }

  const confirm = async () => {
    if (!orgId || !event || !reason.trim()) return
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/admin/org/${orgId}/events/${event.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), refundPayments }),
      })
      const json = await res.json()
      if (json.success) {
        if (json.data?.refunds?.failed > 0) toast.warning(json.message)
        else toast.success(json.message || "Event cancelled")
        setReason("")
        setRefundPayments(true)
        onCancelled()
        onClose()
      } else {
        toast.error(json.message || "Failed to cancel event")
      }
    } catch {
      toast.error("Failed to cancel event")
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Cancel this event?</DialogTitle>
          <DialogDescription>
            {event ? <span className="font-medium text-foreground">{event.title}. </span> : null}
            Pending, confirmed and waitlisted registrations are cancelled and unpaid checkouts are closed. Everyone still registered gets a notification and an email with your reason. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form
          id="cancel-event-form"
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void confirm()
          }}
        >
          <Label htmlFor="cancel-event-reason">Reason</Label>
          <Textarea
            id="cancel-event-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The venue is no longer available"
            maxLength={1000}
            rows={3}
            required
          />
          <label htmlFor="cancel-event-refund" className="flex items-start gap-2.5 pt-2 text-sm">
            <Checkbox id="cancel-event-refund" checked={refundPayments} onCheckedChange={(v) => setRefundPayments(v === true)} className="mt-0.5" />
            <span>
              Refund everyone who paid
              <span className="block text-[13px] text-muted-foreground">Online payments go back through Razorpay; cash and bank payments are marked refunded for you to pay back. Free tickets aren&apos;t affected.</span>
            </span>
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={isCancelling}>Keep event</Button>
          <Button type="submit" form="cancel-event-form" variant="destructive" disabled={isCancelling || !reason.trim()}>
            {isCancelling && <Loader2 className="animate-spin" />}
            Cancel event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

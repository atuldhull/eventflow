"use client"

import { useState } from "react"
import Link from "next/link"
import { Clock, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { statusTone } from "@/lib/status-tone"

/** A paid registration holding a seat while the buyer pays (no ticket yet). */
export interface HeldRegistration {
  id: string
  holdExpiresAt: string | null
  ticketType: string
  payment?: { amount: number; currency?: string | null } | null
  event: { title: string; slug: string; startDate: string }
}

/** Where "Complete payment" goes: the register page's payment step for this registration. */
export const completePaymentHref = (reg: { id: string; event: { slug: string } }) =>
  `/events/${encodeURIComponent(reg.event.slug)}/register?resume=${encodeURIComponent(reg.id)}`

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : null

/**
 * The attendee's held seats, each with "Complete payment" and "Release seat". Releasing
 * is the existing cancel (POST /api/registrations/:id/cancel), which gives the seat back.
 */
export function HeldRegistrations({ items, onReleased }: { items: HeldRegistration[]; onReleased: (id: string) => void }) {
  const [toRelease, setToRelease] = useState<HeldRegistration | null>(null)
  const [isReleasing, setIsReleasing] = useState(false)

  if (items.length === 0) return null

  const release = async () => {
    if (!toRelease) return
    setIsReleasing(true)
    try {
      const res = await fetch(`/api/registrations/${toRelease.id}/cancel`, { method: "POST" })
      const json = await res.json()
      if (json.success) {
        toast.success("Seat released")
        onReleased(toRelease.id)
        setToRelease(null)
      } else {
        toast.error(json.message || "Could not release the seat")
      }
    } catch {
      toast.error("Could not release the seat")
    } finally {
      setIsReleasing(false)
    }
  }

  return (
    <section aria-labelledby="held-heading" className="space-y-3">
      <h2 id="held-heading" className="text-[15px] font-semibold">Awaiting payment</h2>
      <ul className="divide-y divide-rule rounded-lg border">
        {items.map((reg) => {
          const until = fmtTime(reg.holdExpiresAt)
          return (
            <li key={reg.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{reg.event.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                  <span>{reg.ticketType}</span>
                  {reg.payment && reg.payment.amount > 0 && (
                    <span className="tabular-nums">₹{reg.payment.amount.toLocaleString("en-IN")}</span>
                  )}
                  {until && (
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> Seat held until {until}</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Pill tone={statusTone("pending")}>Pending payment</Pill>
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setToRelease(reg)}>
                  Release seat
                </Button>
                <Link href={completePaymentHref(reg)} className={buttonVariants({ size: "sm" })}>
                  Complete payment
                </Link>
              </div>
            </li>
          )
        })}
      </ul>

      <Dialog open={!!toRelease} onOpenChange={(open) => !open && !isReleasing && setToRelease(null)}>
        <DialogContent className="sm:max-w-110">
          <DialogHeader>
            <DialogTitle>Release your held seat?</DialogTitle>
            <DialogDescription>
              {toRelease ? `${toRelease.event.title}. ` : ""}Your registration is cancelled and the seat goes back to the event. You can register again while seats are left.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToRelease(null)} disabled={isReleasing}>Keep my seat</Button>
            <Button variant="destructive" onClick={release} disabled={isReleasing}>
              {isReleasing && <Loader2 className="animate-spin" />}
              Release seat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

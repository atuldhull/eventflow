"use client"

import { useCallback, useState } from "react"
import { Check, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { inr } from "./event-admin"

/* Registration actions shared by the organizer registration screens. */

export interface RegistrationRow {
  id: string
  registrationNumber: string
  participantName: string
  participantEmail: string
  eventTitle: string
  status: string
  ticketType: string
  amount: number
  createdAt: string
}

/**
 * PATCH /api/admin/org/:orgId/registrations/:id/status. Returns `update(id, status, reason?)`
 * and the id currently being updated.
 */
export function useRegistrationStatus(orgId: string | null | undefined, onDone: () => void) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const update = useCallback(async (regId: string, status: "CONFIRMED" | "REJECTED" | "CANCELLED", reason?: string) => {
    if (!orgId) return false
    setBusyId(regId)
    try {
      const res = await fetch(`/api/admin/org/${orgId}/registrations/${regId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
        onDone()
        return true
      }
      toast.error(json.message || "Failed to update the registration")
    } catch {
      toast.error("Failed to update the registration")
    } finally {
      setBusyId(null)
    }
    return false
  }, [orgId, onDone])
  return { update, busyId }
}

/** Approve / Reject for pending rows, Cancel for confirmed ones. */
export function RegistrationRowActions({
  row,
  busy,
  onApprove,
  onReject,
  onCancel,
}: {
  row: RegistrationRow
  busy: boolean
  onApprove: (row: RegistrationRow) => void
  onReject: (row: RegistrationRow) => void
  onCancel: (row: RegistrationRow) => void
}) {
  if (row.status === "PENDING") {
    return (
      <PermissionGate permission={PERMISSIONS.REGISTRATION_APPROVE}>
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="xs" disabled={busy} onClick={() => onApprove(row)} aria-label={`Approve ${row.participantName}`}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />} Approve
          </Button>
          <Button variant="ghost" size="xs" disabled={busy} className="text-muted-foreground hover:text-destructive" onClick={() => onReject(row)} aria-label={`Reject ${row.participantName}`}>
            <X /> Reject
          </Button>
        </div>
      </PermissionGate>
    )
  }
  if (row.status === "CONFIRMED" || row.status === "WAITLISTED") {
    return (
      <PermissionGate permission={PERMISSIONS.REGISTRATION_APPROVE}>
        <Button variant="ghost" size="xs" disabled={busy} className="text-muted-foreground hover:text-destructive" onClick={() => onCancel(row)} aria-label={`Cancel registration for ${row.participantName}`}>
          {busy ? <Loader2 className="animate-spin" /> : <X />} Cancel
        </Button>
      </PermissionGate>
    )
  }
  return null
}

/**
 * Asks before rejecting or cancelling a registration; the reason is optional and goes
 * into the participant's notification.
 */
export function RemoveRegistrationDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: { row: RegistrationRow; action: "REJECTED" | "CANCELLED" } | null
  onClose: () => void
  onConfirm: (row: RegistrationRow, action: "REJECTED" | "CANCELLED", reason?: string) => Promise<boolean>
}) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const reject = target?.action === "REJECTED"

  const close = () => {
    if (busy) return
    setReason("")
    onClose()
  }

  const submit = async () => {
    if (!target) return
    setBusy(true)
    const ok = await onConfirm(target.row, target.action, reason.trim() || undefined)
    setBusy(false)
    if (ok) {
      setReason("")
      onClose()
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{reject ? "Reject this registration?" : "Cancel this registration?"}</DialogTitle>
          <DialogDescription>
            {target ? `${target.row.participantName} · ${target.row.eventTitle}. ` : ""}
            {reject ? "They are told the registration was rejected." : "Their seat and ticket are released and they are notified."}
          </DialogDescription>
        </DialogHeader>
        <form id="remove-registration-form" className="space-y-2" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <Label htmlFor="remove-registration-reason">Reason (optional)</Label>
          <Textarea id="remove-registration-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>Keep</Button>
          <Button type="submit" form="remove-registration-form" variant="destructive" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {reject ? "Reject" : "Cancel registration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface TicketOption {
  id: string
  name: string
  price: number | string
  isActive?: boolean
  quantity?: number | null
  sold?: number
}

/**
 * "Add participant": POST /api/admin/org/:orgId/registrations. The server runs the same
 * capacity, ticket and email steps as a free registration and creates an account for an
 * unknown email.
 */
export function AddParticipantDialog({
  orgId,
  eventId,
  ticketTypes,
  open,
  onOpenChange,
  onAdded,
}: {
  orgId: string | null | undefined
  eventId: string
  ticketTypes: TicketOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const options = ticketTypes.filter((t) => t.isActive !== false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [ticketTypeId, setTicketTypeId] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const chosenId = ticketTypeId || (options.length === 1 ? options[0].id : "")
  const chosen = options.find((t) => t.id === chosenId)
  const label = (t: TicketOption) => {
    const p = Number(t.price)
    const left = t.quantity ? Math.max(0, t.quantity - (t.sold ?? 0)) : null
    return `${t.name} · ${p > 0 ? inr(p) : "Free"}${left !== null ? ` · ${left} left` : ""}`
  }

  const reset = () => {
    setName("")
    setEmail("")
    setTicketTypeId("")
    setError("")
  }

  const submit = async () => {
    if (!orgId) return
    if (!chosenId) { setError("Choose a ticket type."); return }
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/admin/org/${orgId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, name, email, ticketTypeId: chosenId }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message || "Participant added")
        reset()
        onOpenChange(false)
        onAdded()
      } else {
        setError(json.message || "Couldn't add the participant")
      }
    } catch {
      setError("Couldn't add the participant. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (busy) return; if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-[460px]">
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <DialogHeader>
            <DialogTitle>Add a participant</DialogTitle>
            <DialogDescription>
              They get a ticket and a confirmation email. Someone without an account gets one with this email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="add-participant-name">Full name</Label>
              <Input id="add-participant-name" autoComplete="off" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-participant-email">Email</Label>
              <Input id="add-participant-email" type="email" autoComplete="off" required placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-participant-ticket">Ticket type</Label>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">This event has no active ticket types. Add one by editing the event.</p>
              ) : (
                <Select value={chosenId} onValueChange={(v) => setTicketTypeId(v || "")}>
                  <SelectTrigger id="add-participant-ticket" className="w-full">
                    <SelectValue placeholder="Choose a ticket type">
                      {(v: string) => {
                        const t = options.find((o) => o.id === v)
                        return t ? label(t) : "Choose a ticket type"
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{label(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {chosen && Number(chosen.price) > 0 && (
                <p className="text-[13px] text-muted-foreground">Paid tickets are issued as complimentary. No payment is collected.</p>
              )}
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
            <Button type="submit" disabled={busy || options.length === 0}>
              {busy && <Loader2 className="animate-spin" />} Add participant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

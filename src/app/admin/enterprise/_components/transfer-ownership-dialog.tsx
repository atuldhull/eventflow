"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Hand an enterprise to another existing account through
 * POST /api/admin/enterprise/[id]/owner (the current owner or a super admin). Unlocks
 * once the enterprise's name is typed; the API checks the name again.
 */
export function TransferOwnershipDialog({
  open,
  onOpenChange,
  enterprise,
  onTransferred,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  enterprise: { id: string; name: string } | null
  onTransferred?: () => void
}) {
  const [email, setEmail] = useState("")
  const [typed, setTyped] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ field: "email" | "confirm" | null; message: string } | null>(null)
  const name = enterprise?.name ?? ""
  const matches = name.length > 0 && typed.trim().toLowerCase() === name.trim().toLowerCase()

  const close = (next: boolean) => {
    if (pending) return
    if (!next) { setEmail(""); setTyped(""); setError(null) }
    onOpenChange(next)
  }

  const submit = async () => {
    if (!enterprise || !matches || pending) return
    if (!email.trim()) { setError({ field: "email", message: "Enter the new owner's email address" }); return }
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/enterprise/${enterprise.id}/owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerEmail: email.trim(), confirm: typed.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) {
        const message = json?.message || "Failed to transfer ownership"
        setError({ field: json?.errors?.confirm ? "confirm" : json?.errors?.newOwnerEmail ? "email" : null, message })
        return
      }
      toast.success(json.message)
      setEmail(""); setTyped("")
      onOpenChange(false)
      onTransferred?.()
    } catch {
      setError({ field: null, message: "Couldn't reach the server" })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[460px]">
        <form noValidate onSubmit={(e) => { e.preventDefault(); submit() }} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Transfer ownership of {name || "this enterprise"}</DialogTitle>
            <DialogDescription>
              The new owner must already have an EventFlow account. They become an enterprise admin and the only one who can delete
              the enterprise or transfer it again. The current owner stays on as an enterprise admin. The change is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="transfer-email">New owner&apos;s email</Label>
            <Input
              id="transfer-email"
              type="email"
              autoComplete="off"
              placeholder="new.owner@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
              disabled={pending}
              aria-invalid={error?.field === "email" ? true : undefined}
              aria-describedby={error?.field === "email" ? "transfer-error" : undefined}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="transfer-confirm">
              Type <span className="font-mono font-semibold">{name}</span> to confirm
            </Label>
            <Input
              id="transfer-confirm"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => { setTyped(e.target.value); setError(null) }}
              disabled={pending}
              aria-invalid={error?.field === "confirm" ? true : undefined}
              aria-describedby={error?.field === "confirm" ? "transfer-error" : undefined}
            />
          </div>
          {error && <p id="transfer-error" role="alert" className="text-[13px] text-destructive">{error.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={!matches || pending}>
              {pending && <Loader2 className="animate-spin" />}
              Transfer ownership
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

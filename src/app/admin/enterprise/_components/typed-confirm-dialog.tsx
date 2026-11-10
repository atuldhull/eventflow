"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

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
 * A destructive confirmation that only unlocks once the person types the record's name.
 * The typed text is handed to `onConfirm` so the API can check it again server-side.
 */
export function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  actionLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  /** what must be typed, usually the record's name */
  confirmText: string
  actionLabel: string
  /** resolve to close the dialog; throw (or reject) to keep it open */
  onConfirm: (typed: string) => Promise<void>
}) {
  const [typed, setTyped] = useState("")
  const [pending, setPending] = useState(false)
  const matches = typed.trim().toLowerCase() === confirmText.trim().toLowerCase()

  const close = (next: boolean) => {
    if (pending) return
    if (!next) setTyped("")
    onOpenChange(next)
  }

  const submit = async () => {
    if (!matches || pending) return
    setPending(true)
    try {
      await onConfirm(typed.trim())
      setTyped("")
      onOpenChange(false)
    } catch {
      // the caller has already said what went wrong; stay open so they can retry
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[460px]">
        <form noValidate onSubmit={(e) => { e.preventDefault(); submit() }} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="typed-confirm">
              Type <span className="font-mono font-semibold">{confirmText}</span> to confirm
            </Label>
            <Input
              id="typed-confirm"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={!matches || pending}>
              {pending && <Loader2 className="animate-spin" />}
              {actionLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface UndoCheckInDialogProps {
  /** the participant whose check-in would be reversed; null closes the dialog */
  name: string | null | undefined
  open: boolean
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** "Undo check-in for <name>?": one extra tap so a stray touch at the door can't reverse an arrival. */
export function UndoCheckInDialog({ name, open, pending = false, onConfirm, onCancel }: UndoCheckInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onCancel()}>
      <DialogContent className="sm:max-w-100">
        <DialogHeader>
          <DialogTitle>Undo check-in for {name || "this participant"}?</DialogTitle>
          <DialogDescription>They will show as not arrived, and their ticket can be scanned again.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>Keep check-in</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Undo check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

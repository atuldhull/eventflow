"use client"

import { useEffect } from "react"
import { CheckCircle2, AlertTriangle, XCircle, WifiOff, Loader2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatInZone } from "@/lib/event-time"

interface CheckInResultProps {
  type: "success" | "already" | "invalid" | "error"
  participantName?: string
  ticketType?: string
  message?: string
  checkedInAt?: string
  onDismiss: () => void
  autoDismissMs?: number
  /** the scanner is paused on this result; non-success results wait for Dismiss */
  active?: boolean
  /** offered on a successful scan: reverses that check-in */
  onUndo?: () => void
  isUndoing?: boolean
  /** the event's time zone: the earlier check-in time is shown on the event's clock */
  timeZone?: string | null
}

/**
 * The last scan, as a big banner above the camera: solid green for a
 * check-in, amber for a repeat, red for a bad ticket. A success
 * resumes scanning on its own (as before); anything else waits for Dismiss.
 */
export function CheckInResult({
  type,
  participantName,
  ticketType,
  message,
  checkedInAt,
  onDismiss,
  autoDismissMs,
  active = true,
  onUndo,
  isUndoing = false,
  timeZone,
}: CheckInResultProps) {
  useEffect(() => {
    const delay = autoDismissMs ?? (type === "success" ? 2000 : 0)
    if (delay > 0) {
      const timer = setTimeout(onDismiss, delay)
      return () => clearTimeout(timer)
    }
  }, [type, autoDismissMs, onDismiss])

  // Solid fields of colour, readable from arm's length at the door: green for in,
  // amber for a repeat, red for a bad ticket, ink for a network problem.
  const config = {
    success: { tone: "bg-positive text-white dark:text-charcoal", icon: CheckCircle2, title: "Checked in" },
    already: { tone: "bg-warning text-white dark:text-charcoal", icon: AlertTriangle, title: "Already checked in" },
    invalid: { tone: "bg-destructive text-white dark:text-charcoal", icon: XCircle, title: "Invalid ticket" },
    error: { tone: "bg-foreground text-background", icon: WifiOff, title: "Error" },
  }[type]

  const Icon = config.icon
  const detail = [
    ticketType,
    message,
    checkedInAt ? `at ${formatInZone(checkedInAt, timeZone, { hour: "numeric", minute: "2-digit" })}` : null,
  ].filter(Boolean).join(" · ")

  const quiet = "h-11 border-current/40 bg-transparent px-4 text-[15px] text-inherit hover:bg-current/10 dark:bg-transparent dark:hover:bg-current/10"

  return (
    <div
      role={type === "success" ? "status" : "alert"}
      className={cn("rounded-2xl px-5 py-4 motion-safe:animate-[checkin-pop_220ms_ease-out]", config.tone)}
    >
      <div className="flex items-start gap-3.5">
        <Icon className="mt-0.5 size-9 shrink-0" strokeWidth={2.25} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[26px] leading-8 font-bold tracking-[-0.03em]">{config.title}</p>
          {participantName && <p className="mt-0.5 truncate text-[19px] leading-6 font-semibold">{participantName}</p>}
          {detail && <p className="mt-1 text-sm leading-5 opacity-90">{detail}</p>}
        </div>
      </div>
      {(onUndo || (active && type !== "success")) && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {onUndo && (
            <Button variant="outline" className={quiet} onClick={onUndo} disabled={isUndoing}>
              {isUndoing ? <Loader2 className="animate-spin" /> : <Undo2 />}
              Undo
            </Button>
          )}
          {active && type !== "success" && (
            <Button variant="outline" className={quiet} onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      )}
      <style>{"@keyframes checkin-pop{from{transform:scale(.97);opacity:.4}to{transform:none;opacity:1}}"}</style>
    </div>
  )
}

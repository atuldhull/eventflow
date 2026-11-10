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
 * The last scan, as a banner under the camera: positive pill colours for a
 * check-in, warning for a repeat, negative for a bad ticket. A success
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

  const config = {
    success: { tone: "bg-pill-positive text-pill-positive-foreground", icon: CheckCircle2, title: "Checked in" },
    already: { tone: "bg-pill-warning text-pill-warning-foreground", icon: AlertTriangle, title: "Already checked in" },
    invalid: { tone: "bg-pill-negative text-pill-negative-foreground", icon: XCircle, title: "Invalid ticket" },
    error: { tone: "bg-pill-neutral text-pill-neutral-foreground", icon: WifiOff, title: "Error" },
  }[type]

  const Icon = config.icon
  const detail = [
    ticketType,
    message,
    checkedInAt ? `at ${formatInZone(checkedInAt, timeZone, { hour: "numeric", minute: "2-digit" })}` : null,
  ].filter(Boolean).join(" · ")

  const quiet = "h-9 border-current/25 bg-transparent text-inherit hover:bg-current/10 dark:bg-transparent dark:hover:bg-current/10 pointer-coarse:h-11"

  return (
    <div
      role={type === "success" ? "status" : "alert"}
      className={cn("flex items-center gap-3 rounded-lg px-4 py-3", config.tone)}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-5 font-semibold">
          {config.title}
          {participantName && <span className="font-medium"> · {participantName}</span>}
        </p>
        {detail && <p className="mt-0.5 text-[13px] leading-5 opacity-80">{detail}</p>}
      </div>
      {onUndo && (
        <Button variant="outline" size="sm" className={quiet} onClick={onUndo} disabled={isUndoing}>
          {isUndoing ? <Loader2 className="animate-spin" /> : <Undo2 />}
          Undo
        </Button>
      )}
      {active && type !== "success" && (
        <Button variant="outline" size="sm" className={quiet} onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  )
}

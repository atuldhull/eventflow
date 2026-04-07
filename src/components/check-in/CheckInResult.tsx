"use client"

import { useEffect } from "react"
import { CheckCircle, AlertTriangle, XCircle, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CheckInResultProps {
  type: "success" | "already" | "invalid" | "error"
  participantName?: string
  ticketType?: string
  message?: string
  checkedInAt?: string
  onDismiss: () => void
  autoDismissMs?: number
}

export function CheckInResult({
  type,
  participantName,
  ticketType,
  message,
  checkedInAt,
  onDismiss,
  autoDismissMs,
}: CheckInResultProps) {
  useEffect(() => {
    const delay = autoDismissMs ?? (type === "success" ? 2000 : 0)
    if (delay > 0) {
      const timer = setTimeout(onDismiss, delay)
      return () => clearTimeout(timer)
    }
  }, [type, autoDismissMs, onDismiss])

  const config = {
    success: { bg: "bg-green-600", icon: CheckCircle, title: "Checked In ✓" },
    already: { bg: "bg-amber-500", icon: AlertTriangle, title: "Already Checked In" },
    invalid: { bg: "bg-red-600", icon: XCircle, title: "Invalid Ticket" },
    error: { bg: "bg-zinc-700", icon: WifiOff, title: "Error" },
  }[type]

  const Icon = config.icon

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-center justify-center", config.bg)}
      onClick={type !== "success" ? undefined : onDismiss}
    >
      <div className="text-center text-white space-y-4 px-8">
        <Icon className="h-16 w-16 mx-auto animate-in zoom-in duration-300" />
        <h2 className="text-2xl font-bold">{config.title}</h2>
        {participantName && <p className="text-xl">{participantName}</p>}
        {ticketType && <p className="text-white/70">{ticketType}</p>}
        {message && <p className="text-white/80 text-sm">{message}</p>}
        {checkedInAt && <p className="text-white/60 text-sm">at {new Date(checkedInAt).toLocaleTimeString()}</p>}
        {type !== "success" && (
          <Button variant="outline" onClick={onDismiss} className="border-white/30 text-white hover:bg-white/10 mt-4">
            Dismiss
          </Button>
        )}
      </div>
    </div>
  )
}

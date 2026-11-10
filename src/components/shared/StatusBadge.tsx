"use client"

import { Pill } from "@/components/ui/pill"
import { statusLabel, statusTone } from "@/lib/status-tone"

interface StatusBadgeProps {
  status: string
  className?: string
  showDot?: boolean
}

/** Any status string → a tinted pill with a sentence-case label. */
export function StatusBadge({ status, className, showDot = false }: StatusBadgeProps) {
  const isLive = status.toLowerCase() === "ongoing" || status.toLowerCase() === "live"
  return (
    <Pill tone={statusTone(status)} dot={showDot} live={isLive} className={className}>
      {statusLabel(status)}
    </Pill>
  )
}

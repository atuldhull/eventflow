"use client"

import { cn } from "@/lib/utils"

type StatusType =
  | "active" | "published" | "confirmed" | "approved" | "completed" | "paid" | "live"
  | "pending" | "processing" | "review" | "awaiting"
  | "draft" | "inactive" | "paused"
  | "cancelled" | "rejected" | "failed" | "expired"
  | "ongoing"

interface StatusBadgeProps {
  status: string
  className?: string
  showDot?: boolean
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot?: string }> = {
  // Green — positive/active
  active: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
  published: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
  confirmed: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
  approved: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
  paid: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
  live: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },

  // Amber — pending/warning
  pending: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  processing: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  review: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  awaiting: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },

  // Gray — neutral/draft
  draft: { bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
  inactive: { bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
  paused: { bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },

  // Red — negative/error
  cancelled: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  rejected: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  failed: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
  expired: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },

  // Blue — completed
  completed: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },

  // Emerald — ongoing (with pulse)
  ongoing: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
}

function getStyle(status: string) {
  const key = status.toLowerCase().replace(/[_\s-]/g, "")
  return STATUS_STYLES[key] || STATUS_STYLES.draft
}

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const style = getStyle(status)
  const isOngoing = status.toLowerCase() === "ongoing"
  const displayText = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, " ")

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
      style.bg, style.text,
      className,
    )}>
      {showDot && style.dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot, isOngoing && "animate-pulse")} />
      )}
      {displayText}
    </span>
  )
}

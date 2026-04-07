import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface EventStatusBadgeProps {
  status: string
  size?: "sm" | "md" | "lg"
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  PENDING_APPROVAL: { label: "Pending Approval", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  PUBLISHED: { label: "Published", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  REGISTRATION_OPEN: { label: "Registration Open", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  REGISTRATION_CLOSED: { label: "Registration Closed", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  ONGOING: { label: "Ongoing", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  COMPLETED: { label: "Completed", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  POSTPONED: { label: "Postponed", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
}

export function EventStatusBadge({ status, size = "md" }: EventStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "" }

  return (
    <Badge
      variant="secondary"
      className={cn(
        config.className,
        size === "sm" && "text-[10px] px-1.5 py-0",
        size === "lg" && "text-sm px-3 py-1"
      )}
    >
      {config.label}
    </Badge>
  )
}

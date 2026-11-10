import { Pill } from "@/components/ui/pill"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { cn } from "@/lib/utils"

interface EventStatusBadgeProps {
  status: string
  size?: "sm" | "md" | "lg"
}

export function EventStatusBadge({ status, size = "md" }: EventStatusBadgeProps) {
  return (
    <Pill
      tone={statusTone(status)}
      live={status === "ONGOING"}
      className={cn(size === "sm" && "h-5 px-1.5 text-[11px]", size === "lg" && "h-6 px-2.5 text-[13px]")}
    >
      {statusLabel(status)}
    </Pill>
  )
}

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  change?: { value: number; trend: "up" | "down" | "neutral" }
  icon: LucideIcon
  iconColor?: string
  description?: string
  isLoading?: boolean
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  iconColor = "bg-primary/10 text-primary",
  description,
  isLoading = false,
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {change && (
            <div className="flex items-center gap-1">
              {change.trend === "up" && (
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              )}
              {change.trend === "down" && (
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              )}
              {change.trend === "neutral" && (
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "text-xs font-medium",
                  change.trend === "up" && "text-green-500",
                  change.trend === "down" && "text-red-500",
                  change.trend === "neutral" && "text-muted-foreground"
                )}
              >
                {change.trend === "up" ? "+" : ""}
                {change.value}%
              </span>
              {description && (
                <span className="text-xs text-muted-foreground">{description}</span>
              )}
            </div>
          )}
          {!change && description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

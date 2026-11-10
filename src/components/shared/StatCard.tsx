import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  change?: { value: number; trend: "up" | "down" | "neutral" }
  /** kept for compatibility; rendered as a small grey glyph beside the label */
  icon?: LucideIcon
  /** kept for compatibility; KPIs no longer sit on tinted icon tiles */
  iconColor?: string
  description?: string
  isLoading?: boolean
  className?: string
}

/**
 * A KPI is type, not a tile: a 14px grey label, a 28px value at regular
 * weight in tabular figures, and the change written as a phrase. Colour only
 * when there is a real change; a zero change is grey.
 */
export function StatCard({ title, value, change, icon: Icon, description, isLoading = false, className }: StatCardProps) {
  return (
    <Card className={cn("gap-0 px-5 py-4", className)}>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {Icon && <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />}
        <span className="truncate">{title}</span>
      </div>
      {isLoading ? (
        <>
          <Skeleton className="mt-2 h-7 w-24" />
          <Skeleton className="mt-2 h-3.5 w-32" />
        </>
      ) : (
        <>
          <p className="mt-1.5 font-display text-[28px] leading-8 font-semibold tracking-[-0.03em] tabular-nums">{value}</p>
          {(change || description) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {change && (
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    change.trend === "up" && change.value !== 0 && "text-positive",
                    change.trend === "down" && change.value !== 0 && "text-destructive",
                  )}
                >
                  {change.trend === "down" ? "−" : change.value === 0 ? "" : "+"}
                  {Math.abs(change.value)}%
                </span>
              )}
              {change && description ? " " : ""}
              {description}
            </p>
          )}
        </>
      )}
    </Card>
  )
}

/**
 * Several peer KPIs as one card split by 1px dividers. On a phone it becomes
 * a 2-column grid (the last cell spans when the count is odd).
 */
export function KpiStrip({
  items,
  isLoading,
  className,
}: {
  items: { label: string; value: React.ReactNode; caption?: React.ReactNode }[]
  isLoading?: boolean
  className?: string
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden p-0", className)}>
      <dl
        className="grid grid-cols-2 sm:flex sm:divide-x sm:divide-border [&>div]:border-border max-sm:[&>div:nth-child(odd)]:border-r max-sm:[&>div:nth-child(n+3)]:border-t max-sm:[&>div:last-child:nth-child(odd)]:col-span-2 max-sm:[&>div:last-child:nth-child(odd)]:border-r-0"
      >
        {items.map((it) => (
          <div key={it.label} className="min-w-0 flex-1 px-5 py-4">
            <dt className="truncate text-sm text-muted-foreground">{it.label}</dt>
            {isLoading ? (
              <dd><Skeleton className="mt-2 h-7 w-20" /></dd>
            ) : (
              <>
                <dd className="mt-1.5 font-display text-[26px] leading-8 font-semibold tracking-[-0.03em] tabular-nums">{it.value}</dd>
                {it.caption && <dd className="mt-0.5 text-xs text-muted-foreground">{it.caption}</dd>}
              </>
            )}
          </div>
        ))}
      </dl>
    </Card>
  )
}

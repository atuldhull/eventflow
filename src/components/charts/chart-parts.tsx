"use client"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Shared chart chrome. One teal for a single series; teal, blue and amber
 * (chart-1..3) when series must be told apart; greys after that. Hairline
 * gridlines, 12px grey axis figures, no gradients, no entrance animation.
 */
export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export const seriesColor = (index: number, color?: string) => color || SERIES_COLORS[index % SERIES_COLORS.length]

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 })
export const formatTick = (v: unknown) => (typeof v === "number" ? compact.format(v) : String(v ?? ""))
export const formatValue = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-IN") : String(v ?? ""))

const tick = { fontSize: 12, fill: "var(--muted-foreground)", fontFamily: "inherit" }

export const xAxisProps = {
  tick,
  tickLine: false,
  axisLine: { stroke: "var(--border)" },
  tickMargin: 8,
  minTickGap: 16,
} as const

export const yAxisProps = {
  tick,
  tickLine: false,
  axisLine: false,
  tickMargin: 4,
  width: 44,
  tickFormatter: formatTick,
  allowDecimals: false,
} as const

export const gridProps = {
  vertical: false,
  stroke: "var(--rule)",
  strokeDasharray: undefined,
} as const

export function ChartCard({
  title,
  legend,
  children,
  className,
}: {
  title?: string
  legend?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("gap-0 px-5 pt-4 pb-3", className)}>
      {(title || legend) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {title ? <h3 className="text-[15px] font-semibold">{title}</h3> : <span />}
          {legend}
        </div>
      )}
      {children}
    </Card>
  )
}

export function ChartSkeleton({ title, height }: { title?: string; height: number }) {
  return (
    <Card className="gap-0 px-5 pt-4 pb-3" aria-busy="true">
      {title && <Skeleton className="mb-4 h-4 w-40" />}
      <Skeleton className="w-full rounded-md" style={{ height }} />
    </Card>
  )
}

export function ChartEmpty({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center text-[13px] text-muted-foreground" style={{ height }}>
      No data available
    </div>
  )
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px]" style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

interface TooltipEntry {
  name?: string | number
  value?: unknown
  color?: string
  dataKey?: string | number | ((obj: unknown) => unknown)
  payload?: { fill?: string; color?: string }
}

/** The tooltip card: popover surface, a grey label, one line per series in tabular figures. */
export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: readonly TooltipEntry[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-32 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-(--shadow-float)">
      {label !== undefined && label !== "" && <p className="mb-1.5 text-muted-foreground">{String(label)}</p>}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={`${String(p.dataKey ?? p.name)}-${i}`} className="flex items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: p.color || p.payload?.fill || p.payload?.color }} />
            <span className="flex-1 text-muted-foreground">{p.name}</span>
            <span className="font-medium tabular-nums">{formatValue(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

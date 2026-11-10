"use client"

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"
import { ChartCard, ChartEmpty, ChartSkeleton, ChartTooltip, formatValue, seriesColor } from "./chart-parts"

interface DonutChartProps {
  /** colour defaults to chart-1..5 in order; pass var(--chart-N) to choose */
  data: { name: string; value: number; color?: string }[]
  height?: number
  showLegend?: boolean
  isLoading?: boolean
  title?: string
}

/**
 * A ring with its total in the middle; the legend is a list of
 * name, value and share, so the figures read without hovering.
 */
export function DonutChart({
  data,
  height = 300,
  showLegend = true,
  isLoading = false,
  title,
}: DonutChartProps) {
  if (isLoading) return <ChartSkeleton title={title} height={height} />

  const slices = data.map((d, i) => ({ ...d, color: seriesColor(i, d.color) }))
  const total = slices.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  const ring = Math.min(height, 220)

  return (
    <ChartCard title={title}>
      {slices.length === 0 ? (
        <ChartEmpty height={height} />
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative shrink-0" style={{ width: ring, height: ring }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="72%"
                  outerRadius="98%"
                  paddingAngle={slices.length > 1 ? 1 : 0}
                  stroke="var(--card)"
                  strokeWidth={2}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {slices.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={ChartTooltip} isAnimationActive={false} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[22px] leading-7 tracking-[-0.02em] tabular-nums">{formatValue(total)}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>
          {showLegend && (
            <ul className="w-full min-w-0 flex-1 divide-y divide-rule text-sm">
              {slices.map((s) => (
                <li key={s.name} className="flex items-center gap-2.5 py-2">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="tabular-nums">{formatValue(s.value)}</span>
                  <span className="w-11 text-right text-[13px] text-muted-foreground tabular-nums">
                    {total > 0 ? `${Math.round((s.value / total) * 100)}%` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ChartCard>
  )
}

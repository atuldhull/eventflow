"use client"

import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import {
  ChartCard,
  ChartEmpty,
  ChartLegend,
  ChartSkeleton,
  ChartTooltip,
  gridProps,
  seriesColor,
  xAxisProps,
  yAxisProps,
} from "./chart-parts"

interface AreaChartProps {
  data: Record<string, unknown>[]
  xKey: string
  /** colour defaults to chart-1, chart-2, chart-3 in order; pass var(--chart-N) to choose */
  yKeys: { key: string; color?: string; label?: string }[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  isLoading?: boolean
  title?: string
}

/** An area is a line with a flat 10% fill under it, never a gradient. */
export function AreaChart({
  data,
  xKey,
  yKeys,
  height = 300,
  showGrid = true,
  showLegend = true,
  isLoading = false,
  title,
}: AreaChartProps) {
  if (isLoading) return <ChartSkeleton title={title} height={height} />

  const series = yKeys.map((y, i) => ({ ...y, color: seriesColor(i, y.color), name: y.label || y.key }))

  return (
    <ChartCard
      title={title}
      legend={showLegend ? <ChartLegend items={series.map((s) => ({ label: s.name, color: s.color }))} /> : undefined}
    >
      {data.length === 0 ? (
        <ChartEmpty height={height} />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <RechartsAreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            {showGrid && <CartesianGrid {...gridProps} />}
            <XAxis dataKey={xKey} {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={ChartTooltip} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} isAnimationActive={false} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.1}
                name={s.name}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--background)", fill: s.color }}
                isAnimationActive={false}
              />
            ))}
          </RechartsAreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

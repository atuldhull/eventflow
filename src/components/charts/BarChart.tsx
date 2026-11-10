"use client"

import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
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

interface BarChartProps {
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

export function BarChart({
  data,
  xKey,
  yKeys,
  height = 300,
  showGrid = true,
  showLegend = true,
  isLoading = false,
  title,
}: BarChartProps) {
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
          <RechartsBarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} barGap={2}>
            {showGrid && <CartesianGrid {...gridProps} />}
            <XAxis dataKey={xKey} {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={ChartTooltip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} isAnimationActive={false} />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                name={s.name}
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

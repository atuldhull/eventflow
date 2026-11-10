"use client"

import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
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

interface LineChartProps {
  data: Record<string, unknown>[]
  xKey: string
  /** colour defaults to chart-1, chart-2, chart-3 in order; pass var(--chart-N) to choose */
  yKeys: { key: string; color?: string; label?: string; dashed?: boolean }[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  isLoading?: boolean
  title?: string
}

export function LineChart({
  data,
  xKey,
  yKeys,
  height = 300,
  showGrid = true,
  showLegend = true,
  isLoading = false,
  title,
}: LineChartProps) {
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
          <RechartsLineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            {showGrid && <CartesianGrid {...gridProps} />}
            <XAxis dataKey={xKey} {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={ChartTooltip} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} isAnimationActive={false} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                name={s.name}
                strokeDasharray={s.dashed ? "4 4" : undefined}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--background)", fill: s.color }}
                isAnimationActive={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

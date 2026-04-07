"use client"

import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface LineChartProps {
  data: Record<string, unknown>[]
  xKey: string
  yKeys: { key: string; color: string; label?: string; dashed?: boolean }[]
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
  if (isLoading) {
    return (
      <Card className="p-6">
        {title && <Skeleton className="h-5 w-40 mb-4" />}
        <Skeleton className="w-full" style={{ height }} />
      </Card>
    )
  }

  return (
    <Card className="p-6">
      {title && <h3 className="text-sm font-medium mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-border" />}
          <XAxis dataKey={xKey} className="text-xs" tick={{ fontSize: 12 }} />
          <YAxis className="text-xs" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          {showLegend && <Legend />}
          {yKeys.map((y) => (
            <Line
              key={y.key}
              type="monotone"
              dataKey={y.key}
              stroke={y.color}
              name={y.label || y.key}
              strokeDasharray={y.dashed ? "5 5" : undefined}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </Card>
  )
}

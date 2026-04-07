"use client"

import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface AreaChartProps {
  data: Record<string, unknown>[]
  xKey: string
  yKeys: { key: string; color: string; label?: string }[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  isLoading?: boolean
  title?: string
}

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
        <RechartsAreaChart data={data}>
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
            <Area
              key={y.key}
              type="monotone"
              dataKey={y.key}
              stroke={y.color}
              fill={y.color}
              fillOpacity={0.1}
              name={y.label || y.key}
              strokeWidth={2}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </Card>
  )
}

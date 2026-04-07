"use client"

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface DonutChartProps {
  data: { name: string; value: number; color: string }[]
  height?: number
  showLegend?: boolean
  isLoading?: boolean
  title?: string
}

export function DonutChart({
  data,
  height = 300,
  showLegend = true,
  isLoading = false,
  title,
}: DonutChartProps) {
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
      {data.length === 0 ? (
        <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
          No data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            {showLegend && <Legend />}
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

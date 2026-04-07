import { cn } from "@/lib/utils"

interface FunnelStage {
  label: string
  count: number
  percentage: number
  conversionFromPrevious?: number
}

interface FunnelChartProps {
  stages: FunnelStage[]
}

export function FunnelChart({ stages }: FunnelChartProps) {
  const maxCount = stages[0]?.count || 1

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const widthPct = Math.max(10, (stage.count / maxCount) * 100)
        return (
          <div key={stage.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{stage.label}</span>
              <span className="text-sm text-muted-foreground">
                {stage.count.toLocaleString()} ({stage.percentage}%)
              </span>
            </div>
            <div className="h-8 rounded bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded transition-all flex items-center pl-3",
                  i === 0 ? "bg-green-500" :
                  i === 1 ? "bg-emerald-500" :
                  i === 2 ? "bg-blue-500" :
                  i === 3 ? "bg-indigo-500" :
                  i === 4 ? "bg-purple-500" : "bg-amber-500"
                )}
                style={{ width: `${widthPct}%` }}
              >
                <span className="text-xs font-medium text-white">{stage.count.toLocaleString()}</span>
              </div>
            </div>
            {i < stages.length - 1 && stage.conversionFromPrevious !== undefined && (
              <div className="flex items-center gap-1 mt-1 ml-4 text-xs text-muted-foreground">
                <span>↓</span>
                <span>{stage.conversionFromPrevious}% conversion</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

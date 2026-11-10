interface FunnelStage {
  label: string
  count: number
  percentage: number
  conversionFromPrevious?: number
}

interface FunnelChartProps {
  stages: FunnelStage[]
}

/**
 * Stages as single-hue bars: the first stage is full teal, each later stage a
 * step lighter, so the drop-off reads as length rather than as a rainbow.
 */
export function FunnelChart({ stages }: FunnelChartProps) {
  const maxCount = stages[0]?.count || 1

  return (
    <ol className="space-y-3">
      {stages.map((stage, i) => {
        const widthPct = Math.max(2, (stage.count / maxCount) * 100)
        const opacity = Math.max(0.35, 1 - i * 0.15)
        return (
          <li key={stage.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{stage.label}</span>
              <span className="shrink-0 tabular-nums">
                {stage.count.toLocaleString("en-IN")}
                <span className="ml-1.5 text-[13px] text-muted-foreground">{stage.percentage}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-[2px] bg-muted">
              <div className="h-full rounded-[2px] bg-brand" style={{ width: `${widthPct}%`, opacity }} />
            </div>
            {i < stages.length - 1 && stage.conversionFromPrevious !== undefined && (
              <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                {stage.conversionFromPrevious}% continue to the next step
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

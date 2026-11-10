import { cn } from "@/lib/utils"

interface PerformanceScoreProps {
  score: number
  label?: string
  size?: "sm" | "md" | "lg"
}

/** A 0–100 score as a thin ring: teal when healthy, amber in the middle, red when low. */
export function PerformanceScore({ score, label, size = "md" }: PerformanceScoreProps) {
  const clampedScore = Math.max(0, Math.min(100, score))
  const stroke = clampedScore > 70 ? "stroke-brand" : clampedScore > 40 ? "stroke-chart-3" : "stroke-destructive"

  const sizes = {
    sm: { outer: 60, stroke: 4, text: "text-sm" },
    md: { outer: 80, stroke: 5, text: "text-lg" },
    lg: { outer: 120, stroke: 6, text: "text-[28px]" },
  }
  const s = sizes[size]
  const radius = (s.outer - s.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clampedScore / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: s.outer, height: s.outer }} role="img" aria-label={`${label ? `${label}: ` : ""}${clampedScore} out of 100`}>
        <svg className="-rotate-90" width={s.outer} height={s.outer} aria-hidden>
          <circle cx={s.outer / 2} cy={s.outer / 2} r={radius} strokeWidth={s.stroke} fill="none" className="stroke-muted" />
          <circle
            cx={s.outer / 2}
            cy={s.outer / 2}
            r={radius}
            strokeWidth={s.stroke}
            fill="none"
            className={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-medium tracking-[-0.02em] tabular-nums", s.text)}>{clampedScore}</span>
        </div>
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  )
}

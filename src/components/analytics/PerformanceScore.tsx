import { cn } from "@/lib/utils"

interface PerformanceScoreProps {
  score: number
  label?: string
  size?: "sm" | "md" | "lg"
}

export function PerformanceScore({ score, label, size = "md" }: PerformanceScoreProps) {
  const clampedScore = Math.max(0, Math.min(100, score))
  const color = clampedScore > 70 ? "text-green-500" : clampedScore > 40 ? "text-amber-500" : "text-red-500"
  const bgColor = clampedScore > 70 ? "stroke-green-500" : clampedScore > 40 ? "stroke-amber-500" : "stroke-red-500"

  const sizes = { sm: { outer: 60, stroke: 4, text: "text-sm" }, md: { outer: 80, stroke: 5, text: "text-lg" }, lg: { outer: 120, stroke: 6, text: "text-2xl" } }
  const s = sizes[size]
  const radius = (s.outer - s.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clampedScore / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: s.outer, height: s.outer }}>
        <svg className="transform -rotate-90" width={s.outer} height={s.outer}>
          <circle cx={s.outer / 2} cy={s.outer / 2} r={radius} strokeWidth={s.stroke} fill="none" className="stroke-muted" />
          <circle cx={s.outer / 2} cy={s.outer / 2} r={radius} strokeWidth={s.stroke} fill="none" className={bgColor}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold", color, s.text)}>{clampedScore}</span>
        </div>
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  )
}

"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrendIndicatorProps {
  value: number
  suffix?: string
  className?: string
}

export function TrendIndicator({ value, suffix = "%", className }: TrendIndicatorProps) {
  const isPositive = value > 0
  const isNegative = value < 0
  const isNeutral = value === 0

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
      isPositive && "text-green-600 dark:text-green-400",
      isNegative && "text-red-600 dark:text-red-400",
      isNeutral && "text-muted-foreground",
      className,
    )}>
      {isPositive && <TrendingUp className="h-3 w-3" />}
      {isNegative && <TrendingDown className="h-3 w-3" />}
      {isNeutral && <Minus className="h-3 w-3" />}
      {isPositive ? "+" : ""}{value}{suffix}
    </span>
  )
}

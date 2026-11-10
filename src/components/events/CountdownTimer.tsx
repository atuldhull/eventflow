"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface CountdownTimerProps {
  targetDate: string
  label?: string
  className?: string
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * A quiet one-line countdown ("Event starts in 5d 04h 12m 09s"). Figures are
 * tabular so the line doesn't jitter as seconds tick.
 */
export function CountdownTimer({ targetDate, label = "Event starts in", className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const target = new Date(targetDate).getTime()
      const diff = target - now

      if (diff <= 0) {
        setIsExpired(true)
        clearInterval(timer)
        return
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  if (isExpired) return null

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span>{label}</span>
      {/* the first tick lands after a second; hold the line's width until then */}
      <span className="font-medium text-foreground tabular-nums" aria-live="off">
        {timeLeft
          ? `${timeLeft.days}d ${pad(timeLeft.hours)}h ${pad(timeLeft.minutes)}m ${pad(timeLeft.seconds)}s`
          : "        "}
      </span>
    </span>
  )
}

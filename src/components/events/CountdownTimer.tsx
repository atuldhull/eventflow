"use client"

import { useState, useEffect } from "react"

interface CountdownTimerProps {
  targetDate: string
  label?: string
}

export function CountdownTimer({ targetDate, label = "Event starts in" }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
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
    <div className="rounded-lg border bg-muted/30 p-4 text-center">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="flex justify-center gap-3">
        {[
          { value: timeLeft.days, label: "Days" },
          { value: timeLeft.hours, label: "Hours" },
          { value: timeLeft.minutes, label: "Min" },
          { value: timeLeft.seconds, label: "Sec" },
        ].map((unit) => (
          <div key={unit.label} className="flex flex-col items-center">
            <span className="text-2xl font-bold tabular-nums">{String(unit.value).padStart(2, "0")}</span>
            <span className="text-[10px] text-muted-foreground">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

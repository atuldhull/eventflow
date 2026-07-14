"use client"

import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { PartyPopper } from "lucide-react"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface TimeLeft { days: number; hours: number; minutes: number; seconds: number }

function FlipUnit({ value, label, color }: { value: number; max?: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative bg-zinc-900 rounded-xl px-3 py-2 sm:px-5 sm:py-3 shadow-lg">
        <motion.span key={value} className="text-2xl sm:text-4xl md:text-5xl font-bold text-white tabular-nums block" initial={{ rotateX: -90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
          {String(value).padStart(2, "0")}
        </motion.span>
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
      </div>
      {label && <span className="text-xs mt-2 uppercase tracking-wider opacity-60" style={{ color }}>{label}</span>}
    </div>
  )
}

function MinimalUnit({ value, label, color }: { value: number; max?: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <span className="text-4xl sm:text-5xl md:text-7xl font-bold tabular-nums" style={{ color }}>{String(value).padStart(2, "0")}</span>
      {label && <p className="text-xs mt-1 uppercase tracking-wider opacity-50">{label}</p>}
    </div>
  )
}

function BoldUnit({ value, label, color }: { value: number; max?: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-2xl p-4 sm:p-6 shadow-md" style={{ backgroundColor: color }}>
        <span className="text-2xl sm:text-4xl font-bold text-white tabular-nums">{String(value).padStart(2, "0")}</span>
      </div>
      {label && <span className="text-xs mt-2 opacity-60">{label}</span>}
    </div>
  )
}

function CircularUnit({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = (value / max) * 100
  const r = 40; const c = 2 * Math.PI * r; const offset = c - (pct / 100) * c
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20 sm:w-24 sm:h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="opacity-10" />
          <motion.circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }} transition={{ duration: 0.5 }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg sm:text-xl font-bold tabular-nums">{String(value).padStart(2, "0")}</span>
      </div>
      {label && <span className="text-xs mt-1 opacity-60">{label}</span>}
    </div>
  )
}

export function CountdownTimerModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [isComplete, setIsComplete] = useState(false)
  const [nextEvent, setNextEvent] = useState<{ time: number; title: string } | null>(null)

  // A configured custom date is a pure derivation of props, so it is not state.
  const customTime = useMemo(() => {
    if (config.targetType !== "custom-date" || !config.customDate) return null
    const time = new Date(config.customDate).getTime()
    return Number.isNaN(time) ? null : time
  }, [config.targetType, config.customDate])

  // Only look up the next event when no custom date is configured.
  useEffect(() => {
    if (customTime !== null || isPreview) return
    let cancelled = false
    async function loadNextEvent() {
      try {
        const res = await fetch(`/api/events?limit=1&sort=start_date&order=asc`)
        const json = await res.json()
        if (cancelled || !json.success || !json.data[0]) return
        setNextEvent({ time: new Date(json.data[0].startDate).getTime(), title: json.data[0].title })
      } catch {}
    }
    loadNextEvent()
    return () => { cancelled = true }
  }, [customTime, isPreview])

  const targetTime = customTime ?? nextEvent?.time ?? null
  const eventTitle = nextEvent?.title ?? ""

  useEffect(() => {
    // Preview has no real event, so count down to a fixed offset from mount.
    const target = targetTime ?? (isPreview ? Date.now() + 7 * 86400000 : null)
    if (target === null) return

    const timer = setInterval(() => {
      const diff = target - Date.now()
      if (diff <= 0) {
        setIsComplete(true)
        clearInterval(timer)
        return
      }
      setIsComplete(false)
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [targetTime, isPreview])

  if (isComplete) {
    if (config.completionAction === "hide") return null
    return (
      <motion.div className="text-center py-8" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <PartyPopper className="h-12 w-12 mx-auto text-amber-500 mb-4" />
        <p className="text-xl font-bold">{config.completionMessage || "The wait is over!"}</p>
      </motion.div>
    )
  }

  if (targetTime === null && !isPreview) return null

  const style = config.style || "flip"
  const color = "#09090b" // Will be overridden by site styles in actual usage
  const units: { value: number; max: number; label: string; key: string }[] = []
  if (config.showDays !== false) units.push({ value: timeLeft.days, max: 30, label: config.showLabels !== false ? "Days" : "", key: "d" })
  if (config.showHours !== false) units.push({ value: timeLeft.hours, max: 24, label: config.showLabels !== false ? "Hours" : "", key: "h" })
  if (config.showMinutes !== false) units.push({ value: timeLeft.minutes, max: 60, label: config.showLabels !== false ? "Minutes" : "", key: "m" })
  if (config.showSeconds !== false) units.push({ value: timeLeft.seconds, max: 60, label: config.showLabels !== false ? "Seconds" : "", key: "s" })

  const UnitComponent = style === "flip" ? FlipUnit : style === "bold" ? BoldUnit : style === "circular" ? CircularUnit : MinimalUnit

  return (
    <div className="text-center">
      <div className="flex justify-center items-center gap-3 sm:gap-6">
        {units.map((u, i) => (
          <div key={u.key} className="flex items-center gap-3 sm:gap-6">
            <UnitComponent value={u.value} max={u.max} label={u.label} color={color} />
            {i < units.length - 1 && style === "minimal" && <span className="text-3xl sm:text-5xl font-bold opacity-20">:</span>}
          </div>
        ))}
      </div>
      {eventTitle && <p className="text-sm mt-4 opacity-60">Counting down to: {eventTitle}</p>}
    </div>
  )
}

export default CountdownTimerModule

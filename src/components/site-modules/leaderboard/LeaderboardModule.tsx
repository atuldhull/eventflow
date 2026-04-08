"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Trophy, Medal, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Entry { rank: number; name: string; avatar?: string; score: number; change?: number }

const SAMPLE_ENTRIES: Entry[] = [
  { rank: 1, name: "Priya Sharma", score: 850, change: 0 },
  { rank: 2, name: "Rahul Mehta", score: 720, change: 2 },
  { rank: 3, name: "Anita Desai", score: 680, change: -1 },
  { rank: 4, name: "Vikram Singh", score: 610, change: 1 },
  { rank: 5, name: "Sneha Reddy", score: 590, change: -2 },
  { rank: 6, name: "Karan Joshi", score: 540, change: 0 },
  { rank: 7, name: "Deepika Nair", score: 480, change: 3 },
]

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.3 } } }

function Initials({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  return <div className="rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold" style={{ width: size, height: size }}>{initials}</div>
}

export function LeaderboardModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(config.timeRange || "all-time")

  useEffect(() => {
    if (isPreview) { setEntries(SAMPLE_ENTRIES); setIsLoading(false); return }
    async function fetch_() {
      try { const res = await fetch(`/api/modules/leaderboard/entries?orgSlug=${orgSlug}&timeRange=${timeRange}&limit=${config.maxEntries || 25}`); const json = await res.json(); if (json.success) setEntries(json.data) }
      catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [orgSlug, timeRange, config.maxEntries, isPreview])

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  const top3 = config.highlightTop3 ? entries.slice(0, 3) : []
  const rest = config.highlightTop3 ? entries.slice(3) : entries

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" />Leaderboard</h3>
        <div className="flex gap-1 text-xs">
          {["all-time", "this-month", "this-week"].map(t => (
            <button key={t} onClick={() => setTimeRange(t)} className={`px-3 py-1 rounded-full transition-colors ${timeRange === t ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
              {t === "all-time" ? "All Time" : t === "this-month" ? "Month" : "Week"}
            </button>
          ))}
        </div>
      </div>

      {/* Podium */}
      {config.highlightTop3 && top3.length >= 3 && (
        <div className="flex items-end justify-center gap-4 py-4">
          {[1, 0, 2].map((podiumIdx) => {
            const e = top3[podiumIdx]
            const heights = ["h-28", "h-36", "h-24"]
            return (
              <motion.div key={podiumIdx} className="text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: podiumIdx * 0.15 }}>
                <Initials name={e.name} size={podiumIdx === 1 ? 48 : 40} />
                <p className="text-sm font-medium mt-1">{e.name}</p>
                <p className="text-xs font-bold" style={{ color: medalColors[podiumIdx === 1 ? 0 : podiumIdx === 0 ? 1 : 2] }}>{e.score} pts</p>
                <div className={`mt-2 ${heights[podiumIdx]} w-20 rounded-t-xl flex items-center justify-center text-white font-bold text-xl`} style={{ backgroundColor: medalColors[podiumIdx === 1 ? 0 : podiumIdx === 0 ? 1 : 2] }}>
                  {podiumIdx === 1 ? "1" : podiumIdx === 0 ? "2" : "3"}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Table */}
      {rest.length > 0 && (
        <motion.div className="space-y-1" variants={container} initial="hidden" animate="visible">
          {rest.map((e) => (
            <motion.div key={e.rank} variants={item} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <span className="w-8 text-center text-sm font-bold opacity-50">#{e.rank}</span>
              {config.showAvatar && <Initials name={e.name} size={32} />}
              <span className="flex-1 font-medium text-sm">{e.name}</span>
              {e.change !== undefined && e.change !== 0 && (
                <span className={`text-xs flex items-center gap-0.5 ${e.change > 0 ? "text-green-500" : "text-red-500"}`}>
                  {e.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(e.change)}
                </span>
              )}
              {config.showScore && <span className="text-sm font-bold tabular-nums">{e.score}</span>}
            </motion.div>
          ))}
        </motion.div>
      )}

      {entries.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No entries yet</p>}
    </div>
  )
}

export default LeaderboardModule

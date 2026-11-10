"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { BarChart2, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Poll { id: string; title: string; data: any; isActive: boolean }
interface PollOption { text: string; votes: number }

const SAMPLE_POLL: Poll = { id: "sample", title: "Sample Poll", isActive: true, data: { question: "What topic should our next workshop cover?", options: [{ text: "AI & Machine Learning", votes: 45 }, { text: "Web Development", votes: 32 }, { text: "Mobile Apps", votes: 28 }, { text: "Data Science", votes: 18 }] } }

export function LivePollModule({ config, orgSlug, isPreview }: ModuleProps) {
  const [polls, setPolls] = useState<Poll[]>([])
  const [voted, setVoted] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isPreview) { setPolls([SAMPLE_POLL]); setIsLoading(false); return }
    async function fetch_() {
      try { const res = await fetch(`/api/modules/live-poll/polls?orgSlug=${orgSlug}`); const json = await res.json(); if (json.success) setPolls(json.data) } catch {} finally { setIsLoading(false) }
    }
    fetch_()
    const interval = setInterval(fetch_, 5000) // Live poll every 5s
    return () => clearInterval(interval)
  }, [orgSlug, isPreview])

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (voted[pollId] !== undefined && !config.allowMultipleVotes) return
    setVoted((v) => ({ ...v, [pollId]: optionIndex }))
    if (!isPreview) {
      try {
        const res = await fetch(`/api/modules/live-poll/polls/${pollId}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionIndex }) })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          // 409 = this voter already voted on the poll; anything else means the vote was not counted.
          toast.error(json?.message || "Failed to vote")
          if (res.status !== 409) setVoted((v) => { const next = { ...v }; delete next[pollId]; return next })
        }
      }
      catch { toast.error("Failed to vote") }
    }
  }

  const showResults = (pollId: string) => config.showResults === "always" || (config.showResults === "after-vote" && voted[pollId] !== undefined)

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {polls.map((poll) => {
        const options: PollOption[] = poll.data?.options || []
        const totalVotes = options.reduce((s, o) => s + (o.votes || 0), 0)
        const hasVoted = voted[poll.id] !== undefined
        const show = showResults(poll.id)

        return (
          <Card key={poll.id} className="p-6 space-y-4">
            <div className="flex items-center gap-2"><BarChart2 className="h-5 w-5 text-primary" /><h3 className="font-semibold">{poll.data?.question || poll.title}</h3></div>
            <div className="space-y-2">
              {options.map((opt, i) => {
                const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
                const isMyVote = voted[poll.id] === i
                return (
                  <motion.button key={i} onClick={() => handleVote(poll.id, i)} disabled={hasVoted && !config.allowMultipleVotes}
                    className={`w-full text-left rounded-lg p-3 border transition-all relative overflow-hidden ${isMyVote ? "border-primary" : "border-transparent hover:border-primary/30"}`}
                    whileHover={!hasVoted ? { scale: 1.01 } : {}} whileTap={!hasVoted ? { scale: 0.99 } : {}}>
                    {show && <motion.div className="absolute inset-y-0 left-0 bg-primary/10" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />}
                    <div className="relative flex items-center justify-between">
                      <span className="text-sm font-medium">{opt.text}</span>
                      <span className="flex items-center gap-1.5 text-sm">
                        {isMyVote && <Check className="h-3.5 w-3.5 text-primary" />}
                        {show && <span className="font-bold">{pct}%</span>}
                      </span>
                    </div>
                  </motion.button>
                )
              })}
            </div>
            {show && <p className="text-xs text-muted-foreground text-center">{totalVotes} votes</p>}
          </Card>
        )
      })}
      {polls.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No active polls</p>}
    </div>
  )
}

export default LivePollModule

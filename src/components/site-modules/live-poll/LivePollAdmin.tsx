"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2, BarChart2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

export function LivePollAdmin({ config, orgSlug, isPreview }: ModuleProps) {
  const [polls, setPolls] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (isPreview) { setIsLoading(false); return }
    async function fetch_() { try { const res = await fetch(`/api/modules/live-poll/polls?orgSlug=${orgSlug}&status=all`); const json = await res.json(); if (json.success) setPolls(json.data) } catch {} finally { setIsLoading(false) } }
    fetch_()
  }, [orgSlug, isPreview])

  const handleCreate = async () => {
    const validOptions = options.filter(o => o.trim())
    if (!question || validOptions.length < 2) { toast.error("Question and at least 2 options required"); return }
    if (isPreview) { toast.info("Disabled in preview"); return }
    setIsCreating(true)
    try {
      const res = await fetch(`/api/modules/live-poll/polls?orgSlug=${orgSlug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, options: validOptions }) })
      const json = await res.json()
      if (json.success) { toast.success("Poll created"); setQuestion(""); setOptions(["", ""]) } else toast.error(json.message)
    } catch { toast.error("Failed") } finally { setIsCreating(false) }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h3 className="text-lg font-semibold flex items-center gap-2"><BarChart2 className="h-5 w-5" />Live Polls</h3></div>

      <Card className="p-6 space-y-4">
        <Label>Create New Poll</Label>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What should our next event be about?" />
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input value={opt} onChange={(e) => { const u = [...options]; u[i] = e.target.value; setOptions(u) }} placeholder={`Option ${i + 1}`} />
              {options.length > 2 && <Button variant="ghost" size="icon-sm" onClick={() => setOptions(options.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
            </div>
          ))}
          {options.length < 6 && <Button variant="outline" size="sm" onClick={() => setOptions([...options, ""])} className="gap-1"><Plus className="h-3.5 w-3.5" />Add Option</Button>}
        </div>
        <Button onClick={handleCreate} disabled={isCreating}>{isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Create Poll</Button>
      </Card>

      {polls.length > 0 && (
        <div className="space-y-2">
          {polls.map((p) => {
            const totalVotes = (p.data?.options || []).reduce((s: number, o: any) => s + (o.votes || 0), 0)
            return (
              <Card key={p.id} className="p-4 flex items-center justify-between">
                <div><p className="font-medium">{p.data?.question || p.title}</p><p className="text-xs text-muted-foreground">{p.data?.options?.length || 0} options · {totalVotes} votes</p></div>
                <Badge variant={p.isActive !== false ? "default" : "secondary"}>{p.isActive !== false ? "Active" : "Closed"}</Badge>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default LivePollAdmin

"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2, Trophy, Upload, Download, RefreshCw, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface LeaderboardEntry {
  id: string
  name: string
  score: number
  avatar?: string
  source?: string
  updatedAt?: string
}

interface LeaderboardBadge {
  id: string
  name: string
  icon: string
  description: string
  threshold?: number
}

const SAMPLE_ENTRIES: LeaderboardEntry[] = [
  { id: "1", name: "Priya Sharma", score: 850, source: "combined" },
  { id: "2", name: "Rahul Mehta", score: 720, source: "quiz-scores" },
  { id: "3", name: "Anita Desai", score: 680, source: "manual" },
]

export function LeaderboardAdmin({ config, orgSlug, isPreview }: ModuleProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [badges, setBadges] = useState<LeaderboardBadge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRecalculating, setIsRecalculating] = useState(false)

  // Add entry form
  const [newName, setNewName] = useState("")
  const [newScore, setNewScore] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)

  // Edit entry
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editScore, setEditScore] = useState("")

  // Badge form
  const [showBadgeForm, setShowBadgeForm] = useState(false)
  const [badgeName, setBadgeName] = useState("")
  const [badgeIcon, setBadgeIcon] = useState("⭐")
  const [badgeDesc, setBadgeDesc] = useState("")
  const [badgeThreshold, setBadgeThreshold] = useState("")

  useEffect(() => {
    if (isPreview) {
      setEntries(SAMPLE_ENTRIES)
      setIsLoading(false)
      return
    }
    fetchEntries()
  }, [orgSlug, isPreview])

  async function fetchEntries() {
    try {
      const res = await fetch(`/api/modules/leaderboard/entries?orgSlug=${orgSlug}&limit=100`)
      const json = await res.json()
      if (json.success) {
        setEntries(json.data)
        if (json.badges) setBadges(json.badges)
      }
    } catch {} finally {
      setIsLoading(false)
    }
  }

  const handleAddEntry = async () => {
    if (!newName.trim() || !newScore) {
      toast.error("Name and score required")
      return
    }
    if (isPreview) { toast.info("Disabled in preview"); return }

    try {
      const res = await fetch(`/api/modules/leaderboard/entries?orgSlug=${orgSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), score: Number(newScore) }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Entry added")
        setNewName("")
        setNewScore("")
        setShowAddForm(false)
        fetchEntries()
      } else {
        toast.error(json.message)
      }
    } catch {
      toast.error("Failed to add entry")
    }
  }

  const handleUpdateScore = async (entryId: string) => {
    if (!editScore) return
    if (isPreview) { toast.info("Disabled in preview"); return }

    try {
      const res = await fetch(`/api/modules/leaderboard/entries?orgSlug=${orgSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, score: Number(editScore) }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Score updated")
        setEditingId(null)
        setEditScore("")
        fetchEntries()
      } else {
        toast.error(json.message)
      }
    } catch {
      toast.error("Failed to update")
    }
  }

  const handleDelete = async (entryId: string) => {
    if (isPreview) { toast.info("Disabled in preview"); return }

    try {
      const res = await fetch(`/api/modules/leaderboard/entries?orgSlug=${orgSlug}&entryId=${entryId}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Entry removed")
        fetchEntries()
      } else {
        toast.error(json.message)
      }
    } catch {
      toast.error("Failed to delete")
    }
  }

  const handleRecalculate = async () => {
    if (isPreview) { toast.info("Disabled in preview"); return }
    setIsRecalculating(true)
    try {
      const res = await fetch(`/api/modules/leaderboard/entries?orgSlug=${orgSlug}&action=recalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreSource: config.scoreSource }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Scores recalculated")
        fetchEntries()
      } else {
        toast.error(json.message)
      }
    } catch {
      toast.error("Failed to recalculate")
    } finally {
      setIsRecalculating(false)
    }
  }

  const handleExportCsv = () => {
    const csvHeader = "Rank,Name,Score,Source,Last Updated\n"
    const csvRows = entries
      .sort((a, b) => b.score - a.score)
      .map((e, i) => `${i + 1},"${e.name}",${e.score},${e.source || "manual"},${e.updatedAt || ""}`)
      .join("\n")
    const blob = new Blob([csvHeader + csvRows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "leaderboard.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" /> Leaderboard
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1">
            <Download className="h-3.5 w-3.5" />Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(true)} className="gap-1">
            <Plus className="h-3.5 w-3.5" />Add Entry
          </Button>
        </div>
      </div>

      {/* Auto-tracking status */}
      {config.scoreSource && config.scoreSource !== "manual" && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Auto-Tracking Status</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={isRecalculating}
              className="gap-1"
            >
              {isRecalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Recalculate Scores
            </Button>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Score source: <Badge variant="secondary">{config.scoreSource}</Badge></p>
            {config.scoreSource === "quiz-scores" && <p>Scores aggregated from Live Quiz results</p>}
            {config.scoreSource === "event-attendance" && <p>Points per event: {config.pointsPerEvent || 10}</p>}
            {config.scoreSource === "combined" && <p>Combined from quiz scores + event attendance ({config.pointsPerEvent || 10} pts/event)</p>}
          </div>
        </Card>
      )}

      {/* Add entry form */}
      {showAddForm && (
        <Card className="p-4 space-y-3">
          <Label className="text-sm font-medium">Add Manual Entry</Label>
          <div className="flex gap-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Participant name"
              className="flex-1"
            />
            <Input
              type="number"
              value={newScore}
              onChange={(e) => setNewScore(e.target.value)}
              placeholder="Score"
              className="w-28"
            />
            <Button onClick={handleAddEntry} size="sm">Add</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowAddForm(false); setNewName(""); setNewScore("") }}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Entries table */}
      {entries.length > 0 ? (
        <Card className="divide-y">
          <div className="grid grid-cols-[3rem_1fr_5rem_5rem_4rem] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>Rank</span>
            <span>Name</span>
            <span className="text-right">Score</span>
            <span className="text-center">Source</span>
            <span />
          </div>
          {entries
            .sort((a, b) => b.score - a.score)
            .map((entry, idx) => (
              <div key={entry.id} className="grid grid-cols-[3rem_1fr_5rem_5rem_4rem] gap-2 px-4 py-3 items-center text-sm">
                <span className="font-bold text-muted-foreground">#{idx + 1}</span>
                <span className="font-medium">{entry.name}</span>
                <span className="text-right">
                  {editingId === entry.id ? (
                    <Input
                      type="number"
                      value={editScore}
                      onChange={(e) => setEditScore(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleUpdateScore(entry.id); if (e.key === "Escape") { setEditingId(null); setEditScore("") } }}
                      className="h-7 w-20 text-sm"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingId(entry.id); setEditScore(String(entry.score)) }}
                      className="font-bold tabular-nums hover:underline"
                      title="Click to edit"
                    >
                      {entry.score}
                    </button>
                  )}
                </span>
                <span className="text-center">
                  <Badge variant="secondary" className="text-[10px]">{entry.source || "manual"}</Badge>
                </span>
                <span className="flex justify-end">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(entry.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </span>
              </div>
            ))}
        </Card>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">No leaderboard entries yet</p>
      )}

      {/* Badge management */}
      {config.showBadges && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Award className="h-4 w-4" /> Badge Management
            </Label>
            <Button variant="outline" size="sm" onClick={() => setShowBadgeForm(!showBadgeForm)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />Create Badge
            </Button>
          </div>

          {showBadgeForm && (
            <Card className="p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Badge Name</Label>
                  <Input value={badgeName} onChange={(e) => setBadgeName(e.target.value)} placeholder="e.g., Champion" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Icon</Label>
                  <Input value={badgeIcon} onChange={(e) => setBadgeIcon(e.target.value)} placeholder="Emoji icon" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input value={badgeDesc} onChange={(e) => setBadgeDesc(e.target.value)} placeholder="Awarded for..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Auto-assign threshold (points)</Label>
                  <Input type="number" value={badgeThreshold} onChange={(e) => setBadgeThreshold(e.target.value)} placeholder="e.g., 100" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => {
                  if (!badgeName) { toast.error("Badge name required"); return }
                  setBadges([...badges, { id: `b_${Date.now()}`, name: badgeName, icon: badgeIcon, description: badgeDesc, threshold: badgeThreshold ? Number(badgeThreshold) : undefined }])
                  setBadgeName(""); setBadgeIcon("⭐"); setBadgeDesc(""); setBadgeThreshold("")
                  setShowBadgeForm(false)
                  toast.success("Badge created")
                }}>Create Badge</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowBadgeForm(false)}>Cancel</Button>
              </div>
            </Card>
          )}

          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <Card key={badge.id} className="px-3 py-2 flex items-center gap-2">
                  <span className="text-lg">{badge.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{badge.name}</p>
                    <p className="text-xs text-muted-foreground">{badge.description || "No description"}</p>
                    {badge.threshold && <p className="text-[10px] text-muted-foreground">{badge.threshold}+ points</p>}
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => setBadges(badges.filter(b => b.id !== badge.id))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LeaderboardAdmin

"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2, HandHeart, Pencil, Check, X, Download, Mail, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Position {
  id: string
  data: {
    title: string; description: string; event?: string; timeCommitment: string
    spotsTotal: number; spotsFilled: number; skills: string[]; deadline?: string
  }
  isActive: boolean
}

interface Application {
  id: string
  data: {
    positionId: string; name: string; email: string; phone?: string
    why?: string; experience?: string; status: string; appliedAt: string
  }
}

export function VolunteerSignupAdmin({ config, orgSlug, isPreview }: ModuleProps) {
  const [positions, setPositions] = useState<Position[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [viewingApps, setViewingApps] = useState<string | null>(null)
  const [expandedApp, setExpandedApp] = useState<string | null>(null)

  // Form fields
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [event, setEvent] = useState("")
  const [timeCommitment, setTimeCommitment] = useState("")
  const [spotsTotal, setSpotsTotal] = useState("5")
  const [skillsStr, setSkillsStr] = useState("")
  const [deadline, setDeadline] = useState("")

  useEffect(() => {
    if (isPreview) { setIsLoading(false); return }
    fetchPositions()
  }, [orgSlug, isPreview])

  async function fetchPositions() {
    try {
      const res = await fetch(`/api/modules/volunteer-signup/positions?orgSlug=${orgSlug}&status=all`)
      const json = await res.json()
      if (json.success) setPositions(json.data)
    } catch {} finally { setIsLoading(false) }
  }

  async function fetchApplications(positionId: string) {
    try {
      const res = await fetch(`/api/modules/volunteer-signup/positions/${positionId}/apply?orgSlug=${orgSlug}`)
      const json = await res.json()
      if (json.success) setApplications(json.data)
    } catch {}
  }

  const openForm = (position?: Position) => {
    if (position) {
      setEditingPosition(position)
      setTitle(position.data.title); setDescription(position.data.description)
      setEvent(position.data.event || ""); setTimeCommitment(position.data.timeCommitment)
      setSpotsTotal(String(position.data.spotsTotal)); setSkillsStr(position.data.skills.join(", "))
      setDeadline(position.data.deadline || "")
    } else {
      setEditingPosition(null)
      setTitle(""); setDescription(""); setEvent(""); setTimeCommitment("")
      setSpotsTotal("5"); setSkillsStr(""); setDeadline("")
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) { toast.error("Title and description required"); return }
    if (isPreview) { toast.info("Disabled in preview"); return }
    setIsSaving(true)
    const skills = skillsStr.split(",").map(s => s.trim()).filter(Boolean)
    try {
      const method = editingPosition ? "PATCH" : "POST"
      const url = editingPosition
        ? `/api/modules/volunteer-signup/positions?orgSlug=${orgSlug}&positionId=${editingPosition.id}`
        : `/api/modules/volunteer-signup/positions?orgSlug=${orgSlug}`
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, event, timeCommitment, spotsTotal: Number(spotsTotal), skills, deadline }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(editingPosition ? "Position updated" : "Position created")
        setShowForm(false); fetchPositions()
      } else toast.error(json.message)
    } catch { toast.error("Failed to save") } finally { setIsSaving(false) }
  }

  const handleDeletePosition = async (positionId: string) => {
    if (isPreview) return
    try {
      const res = await fetch(`/api/modules/volunteer-signup/positions?orgSlug=${orgSlug}&positionId=${positionId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) { toast.success("Position deleted"); fetchPositions() }
    } catch { toast.error("Failed to delete") }
  }

  const handleUpdateAppStatus = async (appId: string, status: string) => {
    if (isPreview) return
    toast.success(`Application ${status}`)
    setApplications(apps => apps.map(a => a.id === appId ? { ...a, data: { ...a.data, status } } : a))
  }

  const handleExportCsv = () => {
    const csv = "Name,Email,Phone,Status,Applied At\n" +
      applications.map(a => `"${a.data.name}","${a.data.email}","${a.data.phone || ""}","${a.data.status}","${a.data.appliedAt}"`).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "volunteers.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  // Application view for a specific position
  if (viewingApps) {
    const position = positions.find(p => p.id === viewingApps)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setViewingApps(null); setApplications([]) }} className="text-sm text-muted-foreground hover:underline">&larr; Back to Positions</button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1"><Download className="h-3.5 w-3.5" />Export CSV</Button>
        </div>
        <h3 className="font-semibold">Applications for: {position?.data.title}</h3>

        {applications.length > 0 ? (
          <div className="space-y-2">
            {applications.map(app => (
              <Card key={app.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{app.data.name}</p>
                    <p className="text-xs text-muted-foreground">{app.data.email} {app.data.phone && `· ${app.data.phone}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={app.data.status === "accepted" ? "default" : app.data.status === "rejected" ? "destructive" : "secondary"} className="text-[10px]">{app.data.status}</Badge>
                    {app.data.status === "pending" && (
                      <>
                        <Button size="icon-sm" variant="ghost" className="text-green-600" onClick={() => handleUpdateAppStatus(app.id, "accepted")}><Check className="h-3.5 w-3.5" /></Button>
                        <Button size="icon-sm" variant="ghost" className="text-red-500" onClick={() => handleUpdateAppStatus(app.id, "rejected")}><X className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                    <Button size="icon-sm" variant="ghost" onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}><Eye className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {expandedApp === app.id && (
                  <div className="text-sm space-y-2 pt-2 border-t">
                    {app.data.why && <div><p className="text-xs font-medium text-muted-foreground">Why volunteer?</p><p>{app.data.why}</p></div>}
                    {app.data.experience && <div><p className="text-xs font-medium text-muted-foreground">Experience</p><p>{app.data.experience}</p></div>}
                    <p className="text-xs text-muted-foreground">Applied: {new Date(app.data.appliedAt).toLocaleDateString()}</p>
                    <a href={`mailto:${app.data.email}`}><Button variant="outline" size="sm" className="gap-1"><Mail className="h-3 w-3" />Email Applicant</Button></a>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">No applications yet</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><HandHeart className="h-5 w-5" /> Volunteer Positions</h3>
        <Button size="sm" onClick={() => openForm()} className="gap-1"><Plus className="h-3.5 w-3.5" />Create Position</Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <Label className="text-sm font-medium">{editingPosition ? "Edit Position" : "New Position"}</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Stage Manager" /></div>
            <div className="space-y-1"><Label className="text-xs">Event</Label><Input value={event} onChange={e => setEvent(e.target.value)} placeholder="Event name or 'General'" /></div>
            <div className="space-y-1"><Label className="text-xs">Time Commitment</Label><Input value={timeCommitment} onChange={e => setTimeCommitment(e.target.value)} placeholder="e.g., Full Day, 3 hours" /></div>
            <div className="space-y-1"><Label className="text-xs">Spots Available</Label><Input type="number" value={spotsTotal} onChange={e => setSpotsTotal(e.target.value)} min="1" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Description *</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What the role involves..." rows={3} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Required Skills (comma-separated)</Label><Input value={skillsStr} onChange={e => setSkillsStr(e.target.value)} placeholder="Photography, AV Equipment" /></div>
            <div className="space-y-1"><Label className="text-xs">Application Deadline</Label><Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}{editingPosition ? "Update" : "Create"}</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {positions.length > 0 ? (
        <div className="space-y-2">
          {positions.map(pos => (
            <Card key={pos.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{pos.data.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  {pos.data.event && <span>{pos.data.event}</span>}
                  <span>{pos.data.spotsFilled}/{pos.data.spotsTotal} filled</span>
                  <Badge variant={pos.isActive ? "default" : "secondary"} className="text-[10px]">{pos.isActive ? "Open" : "Closed"}</Badge>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => { setViewingApps(pos.id); fetchApplications(pos.id) }}>Applications</Button>
                <Button variant="ghost" size="icon-sm" onClick={() => openForm(pos)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDeletePosition(pos.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">No positions created yet</p>
      )}
    </div>
  )
}

export default VolunteerSignupAdmin

"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2, Users, Pencil, GripVertical, Download, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface TeamMember {
  id: string
  data: {
    name: string; role: string; avatar?: string; bio?: string; email?: string
    department?: string; skills?: string[]
    social?: { linkedin?: string; twitter?: string; github?: string; website?: string }
    isVisible?: boolean
  }
  sortOrder: number
  isActive: boolean
}

export function TeamProfilesAdmin({ config, orgSlug, isPreview }: ModuleProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form fields
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [avatar, setAvatar] = useState("")
  const [bio, setBio] = useState("")
  const [email, setEmail] = useState("")
  const [department, setDepartment] = useState("")
  const [skillsStr, setSkillsStr] = useState("")
  const [linkedin, setLinkedin] = useState("")
  const [twitter, setTwitter] = useState("")
  const [github, setGithub] = useState("")
  const [webUrl, setWebUrl] = useState("")

  useEffect(() => {
    if (isPreview) { setIsLoading(false); return }
    fetchMembers()
  }, [orgSlug, isPreview])

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/modules/merchandise-store/products?orgSlug=${orgSlug}&moduleId=team-profiles&status=all`)
      const json = await res.json()
      if (json.success) setMembers(json.data)
    } catch {} finally { setIsLoading(false) }
  }

  const openForm = (member?: TeamMember) => {
    if (member) {
      setEditingMember(member)
      setName(member.data.name); setRole(member.data.role)
      setAvatar(member.data.avatar || ""); setBio(member.data.bio || "")
      setEmail(member.data.email || ""); setDepartment(member.data.department || "")
      setSkillsStr(member.data.skills?.join(", ") || "")
      setLinkedin(member.data.social?.linkedin || "")
      setTwitter(member.data.social?.twitter || "")
      setGithub(member.data.social?.github || "")
      setWebUrl(member.data.social?.website || "")
    } else {
      setEditingMember(null)
      setName(""); setRole(""); setAvatar(""); setBio(""); setEmail("")
      setDepartment(""); setSkillsStr(""); setLinkedin(""); setTwitter(""); setGithub(""); setWebUrl("")
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim() || !role.trim()) { toast.error("Name and role required"); return }
    if (isPreview) { toast.info("Disabled in preview"); return }
    setIsSaving(true)
    const skills = skillsStr.split(",").map(s => s.trim()).filter(Boolean)
    const social = { linkedin, twitter, github, website: webUrl }

    try {
      const url = `/api/modules/merchandise-store/products?orgSlug=${orgSlug}&moduleId=team-profiles${editingMember ? `&productId=${editingMember.id}` : ""}`
      const method = editingMember ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, avatar, bio, email, department, skills, social }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(editingMember ? "Member updated" : "Member added")
        setShowForm(false); fetchMembers()
      } else toast.error(json.message)
    } catch { toast.error("Failed to save") } finally { setIsSaving(false) }
  }

  const handleDelete = async (memberId: string) => {
    if (isPreview) return
    try {
      const res = await fetch(`/api/modules/merchandise-store/products?orgSlug=${orgSlug}&moduleId=team-profiles&productId=${memberId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) { toast.success("Member removed"); fetchMembers() }
    } catch { toast.error("Failed to delete") }
  }

  const handleImportFromOrg = async () => {
    if (isPreview) { toast.info("Disabled in preview"); return }
    toast.info("Import from org members would fetch from OrganizationMember records")
  }

  const departments = [...new Set(members.map(m => m.data.department).filter(Boolean))]

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Team Profiles</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImportFromOrg} className="gap-1"><Download className="h-3.5 w-3.5" />Import from Org</Button>
          <Button size="sm" onClick={() => openForm()} className="gap-1"><Plus className="h-3.5 w-3.5" />Add Member</Button>
        </div>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <Label className="text-sm font-medium">{editingMember ? "Edit Member" : "Add Team Member"}</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" /></div>
            <div className="space-y-1"><Label className="text-xs">Role/Designation *</Label><Input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g., CTO, Designer" /></div>
            <div className="space-y-1"><Label className="text-xs">Department/Group</Label><Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g., Engineering" list="depts" /><datalist id="depts">{departments.map(d => <option key={d} value={d!} />)}</datalist></div>
            <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="team@org.com" /></div>
            <div className="space-y-1"><Label className="text-xs">Avatar URL</Label><Input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://..." /></div>
            <div className="space-y-1"><Label className="text-xs">Skills (comma-separated)</Label><Input value={skillsStr} onChange={e => setSkillsStr(e.target.value)} placeholder="React, Design, ..." /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Bio</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Brief bio..." rows={2} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">LinkedIn URL</Label><Input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." /></div>
            <div className="space-y-1"><Label className="text-xs">Twitter/X URL</Label><Input value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="https://x.com/..." /></div>
            <div className="space-y-1"><Label className="text-xs">GitHub URL</Label><Input value={github} onChange={e => setGithub(e.target.value)} placeholder="https://github.com/..." /></div>
            <div className="space-y-1"><Label className="text-xs">Website URL</Label><Input value={webUrl} onChange={e => setWebUrl(e.target.value)} placeholder="https://..." /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}{editingMember ? "Update" : "Add"}</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {members.length > 0 ? (
        <div className="space-y-2">
          {members.sort((a, b) => a.sortOrder - b.sortOrder).map(member => (
            <Card key={member.id} className={`p-3 flex items-center gap-3 ${!member.isActive ? "opacity-50" : ""}`}>
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold overflow-hidden">
                {member.data.avatar ? <img src={member.data.avatar} alt="" className="w-full h-full object-cover" /> : member.data.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{member.data.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{member.data.role}</span>
                  {member.data.department && <Badge variant="secondary" className="text-[10px]">{member.data.department}</Badge>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" onClick={() => openForm(member)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(member.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-8">No team members added yet</p>
      )}

      <div className="text-xs text-muted-foreground">Total: {members.length} members</div>
    </div>
  )
}

export default TeamProfilesAdmin

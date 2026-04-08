"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2, Award, Pencil, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ModuleProps } from "@/lib/site-builder/module-renderer"

interface Sponsor {
  id: string
  data: {
    name: string; logo?: string; website?: string; description?: string
    tier: string; socialLinks?: Record<string, string>; promo?: string
  }
  sortOrder: number
}

const TIER_OPTIONS = [
  { value: "title", label: "Title Sponsor" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "bronze", label: "Bronze" },
  { value: "partner", label: "Partner" },
]

export function SponsorShowcaseAdmin({ config, orgSlug, isPreview }: ModuleProps) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form fields
  const [name, setName] = useState("")
  const [logo, setLogo] = useState("")
  const [website, setWebsite] = useState("")
  const [description, setDescription] = useState("")
  const [tier, setTier] = useState("gold")
  const [promo, setPromo] = useState("")

  useEffect(() => {
    if (isPreview) { setIsLoading(false); return }
    fetchSponsors()
  }, [orgSlug, isPreview])

  async function fetchSponsors() {
    try {
      const res = await fetch(`/api/modules/merchandise-store/products?orgSlug=${orgSlug}&moduleId=sponsor-showcase`)
      const json = await res.json()
      if (json.success) setSponsors(json.data)
    } catch {} finally { setIsLoading(false) }
  }

  const openForm = (sponsor?: Sponsor) => {
    if (sponsor) {
      setEditingSponsor(sponsor)
      setName(sponsor.data.name); setLogo(sponsor.data.logo || "")
      setWebsite(sponsor.data.website || ""); setDescription(sponsor.data.description || "")
      setTier(sponsor.data.tier); setPromo(sponsor.data.promo || "")
    } else {
      setEditingSponsor(null)
      setName(""); setLogo(""); setWebsite(""); setDescription(""); setTier("gold"); setPromo("")
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Sponsor name required"); return }
    if (isPreview) { toast.info("Disabled in preview"); return }
    setIsSaving(true)
    try {
      const url = `/api/modules/merchandise-store/products?orgSlug=${orgSlug}&moduleId=sponsor-showcase${editingSponsor ? `&productId=${editingSponsor.id}` : ""}`
      const method = editingSponsor ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logo, website, description, tier, promo }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(editingSponsor ? "Sponsor updated" : "Sponsor added")
        setShowForm(false); fetchSponsors()
      } else toast.error(json.message)
    } catch { toast.error("Failed to save") } finally { setIsSaving(false) }
  }

  const handleDelete = async (sponsorId: string) => {
    if (isPreview) return
    try {
      const res = await fetch(`/api/modules/merchandise-store/products?orgSlug=${orgSlug}&moduleId=sponsor-showcase&productId=${sponsorId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) { toast.success("Sponsor removed"); fetchSponsors() }
    } catch { toast.error("Failed to delete") }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Award className="h-5 w-5" /> Sponsor Showcase</h3>
        <Button size="sm" onClick={() => openForm()} className="gap-1"><Plus className="h-3.5 w-3.5" />Add Sponsor</Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <Label className="text-sm font-medium">{editingSponsor ? "Edit Sponsor" : "New Sponsor"}</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Company name" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Tier</Label>
              <select value={tier} onChange={e => setTier(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                {TIER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Logo URL</Label><Input value={logo} onChange={e => setLogo(e.target.value)} placeholder="https://..." /></div>
            <div className="space-y-1"><Label className="text-xs">Website</Label><Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="About the sponsor..." rows={2} /></div>
          <div className="space-y-1"><Label className="text-xs">Promo/Offer (optional)</Label><Input value={promo} onChange={e => setPromo(e.target.value)} placeholder="Special offer text..." /></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}{editingSponsor ? "Update" : "Add"}</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {TIER_OPTIONS.map(t => {
        const tierSponsors = sponsors.filter(s => s.data.tier === t.value)
        if (tierSponsors.length === 0) return null
        return (
          <div key={t.value} className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">{t.label} ({tierSponsors.length})</h4>
            {tierSponsors.map(sponsor => (
              <Card key={sponsor.id} className="p-3 flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                  {sponsor.data.logo ? <img src={sponsor.data.logo} alt="" className="w-full h-full object-contain rounded" /> : sponsor.data.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{sponsor.data.name}</p>
                  {sponsor.data.website && <p className="text-xs text-muted-foreground truncate">{sponsor.data.website}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => openForm(sponsor)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(sponsor.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )
      })}

      {sponsors.length === 0 && !showForm && (
        <p className="text-center text-sm text-muted-foreground py-8">No sponsors added yet</p>
      )}
    </div>
  )
}

export default SponsorShowcaseAdmin

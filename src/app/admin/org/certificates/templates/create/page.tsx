"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Save, Loader2, Award, Eye } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useRBAC } from "@/hooks/useRBAC"

export default function CreateTemplatePage() {
  const router = useRouter()
  const { currentOrganizationId } = useRBAC()
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("Participation")
  const [titleText, setTitleText] = useState("Certificate of Participation")
  const [bodyText, setBodyText] = useState("has successfully participated in {{event_title}} organized by {{organizer_name}} on {{event_date}}.")
  const [orientation, setOrientation] = useState("landscape")
  const [isDefault, setIsDefault] = useState(false)

  const handleSave = async () => {
    if (!name || !currentOrganizationId) { toast.error("Template name is required"); return }
    setIsSaving(true)
    try {
      const templateData = JSON.stringify({ type, orientation, titleText, bodyText, fontFamily: "serif", colors: { primary: "#1a1a1a", accent: "#c9a96e" } })
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/certificates/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, templateHtml: templateData, isDefault }),
      })
      const data = await res.json()
      if (data.success) { toast.success("Template created!"); router.push("/admin/org/certificates") }
      else toast.error(data.message)
    } catch { toast.error("Failed to save") }
    finally { setIsSaving(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Certificate Template"
        breadcrumbs={[
          { label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" },
          { label: "Certificates", href: "/admin/org/certificates" }, { label: "Create Template" },
        ]}
        actions={
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Template
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Configuration */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-medium">Template Info</h3>
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Tech Fest 2026 Participation" /></div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v || "Participation")}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Participation">Participation</SelectItem><SelectItem value="Achievement">Achievement</SelectItem><SelectItem value="Appreciation">Appreciation</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-medium">Content</h3>
            <div className="space-y-2"><Label>Certificate Title</Label><Input value={titleText} onChange={(e) => setTitleText(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Body Text</Label>
              <Textarea rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
              <p className="text-xs text-muted-foreground">Available tags: {"{{name}}, {{event_title}}, {{event_date}}, {{organizer_name}}, {{certificate_id}}"}</p>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-medium">Settings</h3>
            <div className="space-y-2">
              <Label>Orientation</Label>
              <Select value={orientation} onValueChange={(v) => setOrientation(v || "landscape")}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="landscape">Landscape</SelectItem><SelectItem value="portrait">Portrait</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm">Set as Default</p><p className="text-xs text-muted-foreground">Use for all new events</p></div>
              <Switch checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
            </div>
          </Card>
        </div>

        {/* Preview */}
        <Card className="lg:col-span-3 p-6">
          <h3 className="text-sm font-medium mb-4">Live Preview</h3>
          <div className={`border rounded-lg bg-white overflow-hidden ${orientation === "landscape" ? "aspect-[297/210]" : "aspect-[210/297]"}`}>
            <div className="h-full flex flex-col items-center justify-center text-center p-8 relative">
              <div className="absolute inset-2 border-2 border-double border-amber-300 rounded" />
              <p className="text-[10px] text-muted-foreground tracking-[4px] uppercase mb-4">EventFlow</p>
              <h2 className="text-xl font-serif text-zinc-800">{titleText || "Certificate Title"}</h2>
              <p className="text-xs text-muted-foreground italic mt-2">This is to certify that</p>
              <p className="text-2xl font-bold mt-2 border-b-2 border-amber-300 pb-1 px-8">John Doe</p>
              <p className="text-xs text-muted-foreground mt-3 max-w-[80%] leading-relaxed">{bodyText.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                const samples: Record<string, string> = { name: "John Doe", event_title: "Tech Summit 2026", event_date: "April 15, 2026", organizer_name: "Tech Club", certificate_id: "CERT-A3B7K2" }
                return samples[key] || `{{${key}}}`
              })}</p>
              <p className="absolute bottom-3 left-4 text-[8px] text-muted-foreground">CERT-A3B7K2</p>
              <p className="absolute bottom-3 right-4 text-[8px] text-muted-foreground">Verify: VER-X8MN45PQ</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

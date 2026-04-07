"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Save, Loader2, Upload } from "lucide-react"
import { useRBAC } from "@/hooks/useRBAC"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function EnterpriseBrandingPage() {
  const { currentEnterpriseId } = useRBAC()
  const [isSaving, setIsSaving] = useState(false)
  const [primaryColor, setPrimaryColor] = useState("#09090b")
  const [secondaryColor, setSecondaryColor] = useState("#ffffff")
  const [customDomain, setCustomDomain] = useState("")

  useEffect(() => {
    if (!currentEnterpriseId) return
    async function load() {
      try {
        const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/branding`)
        const json = await res.json()
        if (json.success && json.data) {
          if (json.data.primaryColor) setPrimaryColor(json.data.primaryColor)
          if (json.data.secondaryColor) setSecondaryColor(json.data.secondaryColor)
          if (json.data.customDomain) setCustomDomain(json.data.customDomain)
        }
      } catch {}
    }
    load()
  }, [currentEnterpriseId])

  const handleSave = async () => {
    if (!currentEnterpriseId) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor, secondaryColor, customDomain: customDomain || undefined }),
      })
      const json = await res.json()
      if (json.success) toast.success("Branding saved successfully")
      else toast.error(json.message || "Failed to save")
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Branding"
        description="Customize how your enterprise appears on the platform"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Enterprise", href: "/admin/enterprise" },
          { label: "Branding" },
        ]}
        actions={
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        }
      />

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Brand Identity</h3>
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed hover:border-primary transition-colors cursor-pointer">
            <div className="text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground mt-2">Drag & drop or click to upload</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, SVG (max 2MB)</p>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Banner Image</Label>
          <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed hover:border-primary transition-colors cursor-pointer">
            <p className="text-xs text-muted-foreground">Upload banner (1920x400 recommended)</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Colors</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Primary Color</Label>
            <div className="flex gap-2">
              <Input type="color" defaultValue="#09090b" className="h-10 w-16" />
              <Input defaultValue="#09090b" className="flex-1 font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Secondary Color</Label>
            <div className="flex gap-2">
              <Input type="color" defaultValue="#ffffff" className="h-10 w-16" />
              <Input defaultValue="#ffffff" className="flex-1 font-mono" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Custom Domain</h3>
        <div className="space-y-2">
          <Label>Subdomain (auto-assigned)</Label>
          <Input disabled defaultValue="your-enterprise.eventflow.com" />
        </div>
        <div className="space-y-2">
          <Label>Custom Domain</Label>
          <Input placeholder="events.youruniversity.edu" />
          <p className="text-xs text-muted-foreground">Available on Enterprise plan. Add a CNAME record pointing to cname.eventflow.com</p>
        </div>
      </Card>
    </div>
  )
}

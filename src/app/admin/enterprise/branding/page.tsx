"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Save, Loader2, Upload } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function EnterpriseBrandingPage() {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 500))
      toast.success("Branding saved successfully")
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

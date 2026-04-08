"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Save, Loader2 } from "lucide-react"
import { useRBAC } from "@/hooks/useRBAC"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"

const categories = ["TECHNICAL", "CULTURAL", "SPORTS", "SOCIAL", "ACADEMIC", "OTHER"]

export default function OrgSettingsPage() {
  const { currentOrganizationId } = useRBAC()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!currentOrganizationId) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updated: true }) })
      const json = await res.json()
      if (json.success) toast.success("Settings saved")
      else toast.error(json.message || "Failed to save")
    } catch { toast.error("Failed to save") }
    finally { setIsSaving(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Organization Settings" breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" }, { label: "Settings" }]}
        actions={<PermissionGate permission={PERMISSIONS.ORG_MANAGE_SETTINGS}><Button onClick={handleSave} disabled={isSaving} className="gap-2">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button></PermissionGate>}
      />

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">General Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Name</Label><Input placeholder="Organization name" /></div>
          <div className="space-y-2"><Label>Category</Label><Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Brief description..." rows={3} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Email</Label><Input type="email" /></div>
          <div className="space-y-2"><Label>Phone</Label><Input /></div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Billing & Tax</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>GSTIN</Label><Input placeholder="e.g., 29ABCDE1234F1Z5" /><p className="text-xs text-muted-foreground">GST Identification Number (shown on invoices)</p></div>
          <div className="space-y-2"><Label>PAN</Label><Input placeholder="e.g., ABCDE1234F" /></div>
        </div>
        <div className="space-y-2"><Label>Billing Address</Label><Textarea placeholder="Full address for invoices..." rows={2} /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label>City</Label><Input placeholder="City" /></div>
          <div className="space-y-2"><Label>State</Label><Input placeholder="State" /></div>
          <div className="space-y-2"><Label>PIN Code</Label><Input placeholder="560001" /></div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Social Links</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Website</Label><Input placeholder="https://..." /></div>
          <div className="space-y-2"><Label>Twitter</Label><Input placeholder="https://twitter.com/..." /></div>
          <div className="space-y-2"><Label>Instagram</Label><Input placeholder="https://instagram.com/..." /></div>
          <div className="space-y-2"><Label>LinkedIn</Label><Input placeholder="https://linkedin.com/..." /></div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Event Defaults</h3>
        <div className="flex items-center justify-between py-2">
          <div><p className="text-sm font-medium">Require Approval</p><p className="text-xs text-muted-foreground">Events need admin approval before publishing</p></div>
          <Switch />
        </div>
        <div className="flex items-center justify-between py-2">
          <div><p className="text-sm font-medium">Auto-generate Certificates</p><p className="text-xs text-muted-foreground">Generate participation certificates automatically</p></div>
          <Switch />
        </div>
      </Card>

      <PermissionGate permission={PERMISSIONS.ORG_DELETE}>
        <Card className="p-6 space-y-4 border-destructive/50">
          <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
          <div className="flex items-center justify-between py-2">
            <div><p className="text-sm font-medium">Delete Organization</p><p className="text-xs text-muted-foreground">Permanently delete this organization and all its data</p></div>
            <Button variant="destructive" size="sm">Delete</Button>
          </div>
        </Card>
      </PermissionGate>
    </div>
  )
}

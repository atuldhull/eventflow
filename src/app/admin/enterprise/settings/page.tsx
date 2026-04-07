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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

export default function EnterpriseSettingsPage() {
  const { currentEnterpriseId } = useRBAC()
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({ name: "", type: "", description: "", email: "", phone: "" })

  useEffect(() => {
    if (!currentEnterpriseId) return
    async function load() {
      try {
        const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/settings`)
        const json = await res.json()
        if (json.success && json.data) {
          setForm({ name: json.data.name || "", type: json.data.type || "", description: json.data.description || "", email: json.data.email || "", phone: json.data.phone || "" })
        }
      } catch {}
    }
    load()
  }, [currentEnterpriseId])

  const handleSave = async () => {
    if (!currentEnterpriseId) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) toast.success("Settings saved")
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
        title="Enterprise Settings"
        description="Configure your enterprise"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Enterprise", href: "/admin/enterprise" },
          { label: "Settings" },
        ]}
        actions={
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        }
      />

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">General Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Enterprise Name</Label>
            <Input placeholder="Your Enterprise" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UNIVERSITY">University</SelectItem>
                <SelectItem value="COMPANY">Company</SelectItem>
                <SelectItem value="NGO">NGO</SelectItem>
                <SelectItem value="GOVERNMENT">Government</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea placeholder="Brief description..." rows={3} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Contact Email</Label>
            <Input type="email" placeholder="admin@enterprise.com" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input placeholder="+91 ..." />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-medium">Event Defaults</h3>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Require Event Approval</p>
            <p className="text-xs text-muted-foreground">Events need enterprise admin approval before publishing</p>
          </div>
          <Switch />
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Auto-generate Certificates</p>
            <p className="text-xs text-muted-foreground">Automatically generate participation certificates</p>
          </div>
          <Switch />
        </div>
      </Card>

      <Card className="p-6 space-y-4 border-destructive/50">
        <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Delete Enterprise</p>
            <p className="text-xs text-muted-foreground">Permanently delete this enterprise and all its data</p>
          </div>
          <Button variant="destructive" size="sm">Delete Enterprise</Button>
        </div>
      </Card>
    </div>
  )
}

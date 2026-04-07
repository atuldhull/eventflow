"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Building2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useRBAC } from "@/hooks/useRBAC"

const CATEGORIES = ["TECHNICAL", "CULTURAL", "SPORTS", "ACADEMIC", "SOCIAL", "PROFESSIONAL", "OTHER"]

export default function CreateOrgPage() {
  const router = useRouter()
  const { setOrganizationContext } = useRBAC()
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", category: "", description: "", email: "", phone: "", website: "" })

  const handleSlugify = (name: string) => {
    setForm({ ...form, name, slug: name.toLowerCase().replace(/[^\w ]+/g, "").replace(/ +/g, "-") })
  }

  const handleCreate = async () => {
    if (!form.name || !form.email) { toast.error("Name and email are required"); return }
    setIsCreating(true)
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Organization created!")
        setOrganizationContext(json.data.id)
        router.push("/admin/org")
      } else {
        toast.error(json.message || "Failed to create")
      }
    } catch { toast.error("Failed to create organization") }
    finally { setIsCreating(false) }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <PageHeader title="Create Organization" description="Set up your organization to start hosting events" />

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>Organization Name *</Label>
          <Input value={form.name} onChange={(e) => handleSlugify(e.target.value)} placeholder="e.g., CodeCraft — IIT Bombay Coding Club" />
        </div>
        <div className="space-y-2">
          <Label>URL Slug</Label>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>eventflow.com/org/</span>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="codecraft-iit-bombay" className="flex-1" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v || "" })}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Briefly describe your organization..." rows={3} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="club@college.edu" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 9876543210" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Website</Label>
          <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yourclub.com" />
        </div>
        <Button onClick={handleCreate} disabled={isCreating} className="w-full gap-2">
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
          Create Organization
        </Button>
      </Card>
    </div>
  )
}

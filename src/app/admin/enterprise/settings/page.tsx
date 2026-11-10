"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useRBAC } from "@/hooks/useRBAC"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Section } from "../_components/admin-ui"
import { TypedConfirmDialog } from "../_components/typed-confirm-dialog"
import { TransferOwnershipDialog } from "../_components/transfer-ownership-dialog"

const TYPES = [
  { value: "UNIVERSITY", label: "University" },
  { value: "COMPANY", label: "Company" },
  { value: "NGO", label: "NGO" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "OTHER", label: "Other" },
]

interface Form {
  name: string
  type: string
  description: string
  email: string
  phone: string
  website: string
  requireEventApproval: boolean
  autoGenerateCertificates: boolean
}

const EMPTY: Form = { name: "", type: "", description: "", email: "", phone: "", website: "", requireEventApproval: false, autoGenerateCertificates: false }

function ToggleRow({ id, title, description, checked, onCheckedChange }: { id: string; title: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} id={`${id}-label`} className="text-sm font-medium">{title}</Label>
        <p id={`${id}-hint`} className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} className="mt-0.5" checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export default function EnterpriseSettingsPage() {
  const router = useRouter()
  const { currentEnterpriseId, setEnterpriseContext, refreshPermissions } = useRBAC()
  const [transferOpen, setTransferOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saved, setSaved] = useState<Form>(EMPTY)
  const [meta, setMeta] = useState({ slug: "", isOwner: false })
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!currentEnterpriseId) return
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/settings`)
        const json = await res.json()
        if (cancelled) return
        if (json.success && json.data) {
          const d = json.data
          const next: Form = {
            name: d.name || "",
            type: d.type || "",
            description: d.description || "",
            email: d.email || "",
            phone: d.phone || "",
            website: d.website || "",
            requireEventApproval: !!d.settings?.requireEventApproval,
            autoGenerateCertificates: !!d.settings?.autoGenerateCertificates,
          }
          setForm(next)
          setSaved(next)
          setMeta({ slug: d.slug || "", isOwner: !!d.isOwner })
        } else {
          toast.error(json.message || "Failed to load settings")
        }
      } catch {
        if (!cancelled) toast.error("Failed to load settings")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentEnterpriseId])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const handleSave = async () => {
    if (!currentEnterpriseId) return
    if (!form.name.trim()) { toast.error("Enterprise name is required"); return }
    if (!form.email.trim()) { toast.error("Contact email is required"); return }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type || null,
          description: form.description,
          email: form.email.trim(),
          phone: form.phone,
          website: form.website.trim(),
          settings: { requireEventApproval: form.requireEventApproval, autoGenerateCertificates: form.autoGenerateCertificates },
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSaved(form)
        toast.success("Settings saved")
      } else toast.error(json.message || "Failed to save")
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (typed: string) => {
    const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    })
    const json = await res.json().catch(() => null)
    if (!json?.success) {
      toast.error(json?.message || "Failed to delete enterprise")
      throw new Error("delete failed")
    }
    toast.success(json.message)
    setEnterpriseContext(null)
    router.push("/admin")
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Details and defaults for your enterprise"
        actions={
          <Button onClick={handleSave} disabled={isSaving || isLoading || !dirty}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save settings
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); handleSave() }} className="space-y-8">
          <Section title="General" description="The name and contact details shown to your organizations.">
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="ent-name">Enterprise name</Label>
                  <Input id="ent-name" placeholder="Your Enterprise" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ent-type">Type</Label>
                  <Select items={TYPES} value={form.type || null} onValueChange={(v) => set("type", (v as string) || "")}>
                    <SelectTrigger id="ent-type" className="w-full data-[size=default]:h-9">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ent-description">Description</Label>
                <Textarea id="ent-description" placeholder="Brief description…" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="ent-email">Contact email</Label>
                  <Input id="ent-email" type="email" placeholder="admin@enterprise.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ent-phone">Phone</Label>
                  <Input id="ent-phone" type="tel" placeholder="+91 …" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ent-website">Website</Label>
                <Input id="ent-website" type="url" placeholder="https://www.example.edu" value={form.website} onChange={(e) => set("website", e.target.value)} />
              </div>
            </div>
          </Section>

          <Section title="Event defaults" description="Rules applied to every organization's events.">
            <div className="divide-y divide-rule">
              <ToggleRow
                id="ent-approval"
                title="Require event approval"
                description="Events need enterprise admin approval before publishing."
                checked={form.requireEventApproval}
                onCheckedChange={(v) => set("requireEventApproval", v)}
              />
              <ToggleRow
                id="ent-certificates"
                title="Auto-generate certificates"
                description="After an event ends, issue participation certificates to checked-in attendees with the organization's default template."
                checked={form.autoGenerateCertificates}
                onCheckedChange={(v) => set("autoGenerateCertificates", v)}
              />
            </div>
          </Section>

          {meta.isOwner && (
            <Section title="Danger zone" description="Only the enterprise owner sees this.">
              <div className="mb-3 flex flex-col gap-3 rounded-lg border border-destructive/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Transfer ownership</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Make another person the owner. You stay on as an enterprise admin.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-destructive/40 text-destructive hover:bg-pill-negative hover:text-destructive"
                  onClick={() => setTransferOpen(true)}
                >
                  Transfer ownership
                </Button>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Delete enterprise</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Hides the enterprise and switches it off. Its organizations and their events are kept.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-destructive/40 text-destructive hover:bg-pill-negative hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete enterprise
                </Button>
              </div>
            </Section>
          )}
        </form>
      )}

      <TypedConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${saved.name || "this enterprise"}?`}
        description="The enterprise disappears from every admin's list and its custom domain is released. This is recorded in the audit log."
        confirmText={saved.name || meta.slug}
        actionLabel="Delete enterprise"
        onConfirm={handleDelete}
      />

      <TransferOwnershipDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        enterprise={currentEnterpriseId ? { id: currentEnterpriseId, name: saved.name || meta.slug } : null}
        onTransferred={() => {
          // no longer the owner: hide the danger zone and refresh what this role can do
          setMeta((m) => ({ ...m, isOwner: false }))
          refreshPermissions()
        }}
      />
    </div>
  )
}

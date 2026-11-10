"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, Loader2 } from "lucide-react"
import { useRBAC } from "@/hooks/useRBAC"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import type { OrgProfile } from "@/lib/org-profile"

const CATEGORIES = ["TECHNICAL", "CULTURAL", "SPORTS", "ACADEMIC", "SOCIAL", "PROFESSIONAL", "CORPORATE", "HR", "ENGINEERING", "MARKETING", "OTHER"]
const categoryLabel = (c: string) => (c.length <= 2 ? c : c.charAt(0) + c.slice(1).toLowerCase())

const EMPTY: OrgProfile = {
  name: "", category: "", description: "", email: "", phone: "", website: "", address: "", city: "", state: "",
  socialLinks: { twitter: "", instagram: "", linkedin: "" },
  billing: { gstin: "", pan: "", pinCode: "" },
  eventDefaults: { requireApproval: false, autoGenerateCertificates: false },
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-rule pt-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  )
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function ToggleRow({ id, title, description, checked, onChange, disabled }: {
  id: string; title: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3">
      <div>
        <Label htmlFor={id}>{title}</Label>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} disabled={disabled} />
    </div>
  )
}

export default function OrgSettingsPage() {
  const router = useRouter()
  const { currentOrganizationId, can, setOrganizationContext } = useRBAC()
  const canEdit = can(PERMISSIONS.ORG_MANAGE_SETTINGS)
  const [form, setForm] = useState<OrgProfile>(EMPTY)
  const [saved, setSaved] = useState<OrgProfile>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteName, setDeleteName] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!currentOrganizationId) return
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/settings`)
        const json = await res.json()
        if (cancelled) return
        if (json.success) {
          const profile: OrgProfile = { ...EMPTY, ...json.data }
          setForm(profile)
          setSaved(profile)
          setLoadError(null)
        } else {
          setLoadError(json.message || "Could not load settings")
        }
      } catch {
        if (!cancelled) setLoadError("Could not load settings")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentOrganizationId])

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved)
  const set = <K extends keyof OrgProfile>(key: K, value: OrgProfile[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setIn = <K extends "socialLinks" | "billing">(group: K, key: keyof OrgProfile[K], value: string) =>
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }))
  const err = (path: string) => errors[path]
  const described = (id: string, path: string) => (err(path) ? `${id}-error` : undefined)

  const handleSave = async () => {
    if (!currentOrganizationId) return
    setIsSaving(true)
    setErrors({})
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        const profile: OrgProfile = { ...EMPTY, ...(json.data ?? form) }
        setForm(profile)
        setSaved(profile)
        toast.success("Settings saved")
      } else {
        setErrors(json.errors ?? {})
        toast.error(json.errors ? "Check the highlighted fields" : json.message || "Failed to save")
      }
    } catch { toast.error("Failed to save") }
    finally { setIsSaving(false) }
  }

  const handleDelete = async () => {
    if (!currentOrganizationId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: deleteName }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.message || "Failed to delete"); return }
      toast.success("Organization deleted")
      setDeleteOpen(false)
      setOrganizationContext(null)
      router.push("/admin")
    } catch { toast.error("Failed to delete") }
    finally { setIsDeleting(false) }
  }

  const disabled = !canEdit || isLoading || isSaving
  const categoryOptions = form.category && !CATEGORIES.includes(form.category) ? [form.category, ...CATEGORIES] : CATEGORIES

  if (loadError) {
    return (
      <div className="max-w-4xl space-y-6">
        <PageHeader title="Settings" description="Your organization's profile, billing details and defaults" />
        <p role="alert" className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Settings"
        description="Your organization's profile, billing details and defaults"
        actions={
          <PermissionGate permission={PERMISSIONS.ORG_MANAGE_SETTINGS}>
            {isDirty && !isSaving && (
              <Button variant="ghost" onClick={() => { setForm(saved); setErrors({}) }}>Discard</Button>
            )}
            <Button onClick={handleSave} disabled={isSaving || isLoading || !isDirty}>
              {isSaving && <Loader2 className="animate-spin" />} Save changes
            </Button>
          </PermissionGate>
        }
      />

      {isLoading ? (
        <div className="space-y-8" aria-busy="true" aria-label="Loading settings">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-4 border-t border-rule pt-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
              <Skeleton className="h-10 w-40" />
              <div className="space-y-3">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); if (canEdit && isDirty) handleSave() }}>
          <Section title="General" description="How your organization appears on EventFlow.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="org-name" label="Name" error={err("name")}>
                <Input id="org-name" placeholder="Organization name" value={form.name} onChange={(e) => set("name", e.target.value)} disabled={disabled} aria-invalid={!!err("name")} aria-describedby={described("org-name", "name")} />
              </Field>
              <Field id="org-category" label="Category" error={err("category")}>
                <Select value={form.category || null} onValueChange={(v) => set("category", v || "")} disabled={disabled}>
                  <SelectTrigger id="org-category" className="w-full">
                    <SelectValue placeholder="Select">{(v: string | null) => (v ? categoryLabel(v) : "Select")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>{categoryOptions.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field id="org-description" label="Description" error={err("description")}>
              <Textarea id="org-description" placeholder="Brief description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} disabled={disabled} aria-invalid={!!err("description")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="org-email" label="Email" error={err("email")}>
                <Input id="org-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={disabled} aria-invalid={!!err("email")} aria-describedby={described("org-email", "email")} />
              </Field>
              <Field id="org-phone" label="Phone" error={err("phone")}>
                <Input id="org-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={disabled} aria-invalid={!!err("phone")} aria-describedby={described("org-phone", "phone")} />
              </Field>
            </div>
          </Section>

          <Section title="Billing and tax" description="Printed on the invoices participants receive.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="org-gstin" label="GSTIN" hint="GST Identification Number (shown on invoices)" error={err("billing.gstin")}>
                <Input id="org-gstin" placeholder="e.g., 29ABCDE1234F1Z5" value={form.billing.gstin} onChange={(e) => setIn("billing", "gstin", e.target.value.toUpperCase())} disabled={disabled} aria-invalid={!!err("billing.gstin")} aria-describedby={described("org-gstin", "billing.gstin") ?? "org-gstin-hint"} className="font-mono" maxLength={15} />
              </Field>
              <Field id="org-pan" label="PAN" error={err("billing.pan")}>
                <Input id="org-pan" placeholder="e.g., ABCDE1234F" value={form.billing.pan} onChange={(e) => setIn("billing", "pan", e.target.value.toUpperCase())} disabled={disabled} aria-invalid={!!err("billing.pan")} aria-describedby={described("org-pan", "billing.pan")} className="font-mono" maxLength={10} />
              </Field>
            </div>
            <Field id="org-address" label="Billing address" error={err("address")}>
              <Textarea id="org-address" placeholder="Full address for invoices" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} disabled={disabled} aria-invalid={!!err("address")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="org-city" label="City" error={err("city")}>
                <Input id="org-city" placeholder="City" autoComplete="address-level2" value={form.city} onChange={(e) => set("city", e.target.value)} disabled={disabled} />
              </Field>
              <Field id="org-state" label="State" error={err("state")}>
                <Input id="org-state" placeholder="State" autoComplete="address-level1" value={form.state} onChange={(e) => set("state", e.target.value)} disabled={disabled} />
              </Field>
              <Field id="org-pin" label="PIN code" error={err("billing.pinCode")}>
                <Input id="org-pin" placeholder="560001" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.billing.pinCode} onChange={(e) => setIn("billing", "pinCode", e.target.value)} disabled={disabled} aria-invalid={!!err("billing.pinCode")} aria-describedby={described("org-pin", "billing.pinCode")} />
              </Field>
            </div>
          </Section>

          <Section title="Social links" description="Shown on your public organization page.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="org-website" label="Website" error={err("website")}>
                <Input id="org-website" type="url" placeholder="https://..." value={form.website} onChange={(e) => set("website", e.target.value)} disabled={disabled} aria-invalid={!!err("website")} aria-describedby={described("org-website", "website")} />
              </Field>
              {(["twitter", "instagram", "linkedin"] as const).map((key) => (
                <Field key={key} id={`org-${key}`} label={key === "linkedin" ? "LinkedIn" : key.charAt(0).toUpperCase() + key.slice(1)} error={err(`socialLinks.${key}`)}>
                  <Input
                    id={`org-${key}`}
                    type="url"
                    placeholder={`https://${key === "twitter" ? "x.com" : `${key}.com`}/...`}
                    value={form.socialLinks[key]}
                    onChange={(e) => setIn("socialLinks", key, e.target.value)}
                    disabled={disabled}
                    aria-invalid={!!err(`socialLinks.${key}`)}
                    aria-describedby={described(`org-${key}`, `socialLinks.${key}`)}
                  />
                </Field>
              ))}
            </div>
          </Section>

          <Section title="Event defaults" description="Applied to new events you create.">
            <div className="divide-y divide-rule rounded-lg border">
              <ToggleRow
                id="org-require-approval"
                title="Require approval"
                description="New events start with registration approval on, so you approve each registration"
                checked={form.eventDefaults.requireApproval}
                onChange={(v) => set("eventDefaults", { ...form.eventDefaults, requireApproval: v })}
                disabled={disabled}
              />
              <ToggleRow
                id="org-auto-certs"
                title="Auto-generate certificates"
                description="After an event ends, issue participation certificates to checked-in attendees with your default template"
                checked={form.eventDefaults.autoGenerateCertificates}
                onChange={(v) => set("eventDefaults", { ...form.eventDefaults, autoGenerateCertificates: v })}
                disabled={disabled}
              />
            </div>
          </Section>

          <Section title="Developers" description="API keys and webhooks for your own integrations.">
            <Link
              href="/admin/org/settings/developers"
              className="flex min-h-12 items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <span>
                <span className="font-medium">API keys and webhooks</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">Create keys, add webhook endpoints</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </Section>

          <PermissionGate permission={PERMISSIONS.ORG_DELETE}>
            <Section title="Danger zone" description="Actions here can't be undone.">
              <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Delete organization</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">Remove this organization and its events from EventFlow</p>
                </div>
                <Button type="button" variant="destructive" size="sm" className="max-sm:w-full" onClick={() => { setDeleteName(""); setDeleteOpen(true) }}>Delete</Button>
              </div>
            </Section>
          </PermissionGate>
        </form>
      )}

      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!isDeleting) setDeleteOpen(open) }}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); handleDelete() }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Delete {saved.name}?</DialogTitle>
              <DialogDescription>
                The organization, its website and its events stop being available to everyone. Type its name to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="delete-confirm">Organization name</Label>
              <Input id="delete-confirm" autoComplete="off" value={deleteName} onChange={(e) => setDeleteName(e.target.value)} placeholder={saved.name} />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={isDeleting} />}>Cancel</DialogClose>
              <Button type="submit" variant="destructive" disabled={isDeleting || deleteName.trim() !== saved.name}>
                {isDeleting && <Loader2 className="animate-spin" />} Delete organization
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

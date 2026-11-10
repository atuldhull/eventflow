"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRBAC } from "@/hooks/useRBAC"
import { statusLabel } from "@/lib/status-tone"
import { ORG_CATEGORIES, organizationUpdateSchema } from "@/lib/enterprise-admin"
import { Section } from "../../../_components/admin-ui"
import { ImageDropZone } from "../../../_components/image-drop-zone"

interface Form {
  name: string
  category: string
  description: string
  email: string
  phone: string
  website: string
  city: string
  state: string
  country: string
  logo: string | null
  isActive: boolean
}

type Field = keyof Form

const categoryItems = ORG_CATEGORIES.map((value) => ({ value, label: statusLabel(value) }))

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} role="alert" className="text-xs text-destructive">{message}</p>
}

export default function EditOrganizationPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params)
  const router = useRouter()
  const { currentEnterpriseId } = useRBAC()
  const [form, setForm] = useState<Form | null>(null)
  const [orgName, setOrgName] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!currentEnterpriseId) return
    let cancelled = false
    fetch(`/api/admin/enterprise/${currentEnterpriseId}/organizations/${orgId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (cancelled) return
        if (!json?.success) { setLoadError(json?.message || "Organization not found"); return }
        const d = json.data
        setOrgName(d.name)
        setForm({
          name: d.name || "",
          category: d.category || "",
          description: d.description || "",
          email: d.email || "",
          phone: d.phone || "",
          website: d.website || "",
          city: d.city || "",
          state: d.state || "",
          country: d.country || "",
          logo: d.logo || null,
          isActive: !!d.isActive,
        })
      })
      .catch(() => { if (!cancelled) setLoadError("Failed to load organization") })
    return () => { cancelled = true }
  }, [currentEnterpriseId, orgId])

  const set = <K extends Field>(key: K, value: Form[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const handleSave = async () => {
    if (!form || !currentEnterpriseId) return
    const payload = { ...form, email: form.email.trim(), website: form.website.trim() }
    const parsed = organizationUpdateSchema.safeParse(payload)
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field
        if (key && !next[key]) next[key] = issue.message
      }
      setErrors(next)
      toast.error("Check the highlighted fields")
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) { toast.error(json?.message || "Failed to save"); return }
      toast.success("Organization saved")
      router.push(`/admin/enterprise/organizations/${orgId}`)
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const err = (field: Field) =>
    errors[field] ? { "aria-invalid": true as const, "aria-describedby": `${field}-error` } : {}

  const breadcrumbs = [
    { label: "Organizations", href: "/admin/enterprise/organizations" },
    { label: orgName || "Details", href: `/admin/enterprise/organizations/${orgId}` },
    { label: "Edit" },
  ]

  if (loadError) {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="Edit organization" breadcrumbs={breadcrumbs} />
        <EmptyState title={loadError} description="It may have been deleted, or it belongs to another enterprise.">
          <Link href="/admin/enterprise/organizations" className={buttonVariants({ variant: "outline" })}>Back to organizations</Link>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={orgName ? `Edit ${orgName}` : "Edit organization"} breadcrumbs={breadcrumbs} />

      {!form ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); handleSave() }} className="space-y-8">
          <Section title="Basics" description="The name, category and description people see.">
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Organization name</Label>
                <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={100} {...err("name")} />
                <FieldError id="name-error" message={errors.name} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="category">Category</Label>
                <Select items={categoryItems} value={form.category || null} onValueChange={(v) => set("category", (v as string) || "")}>
                  <SelectTrigger id="category" className="w-full data-[size=default]:h-9" {...err("category")}>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryItems.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError id="category-error" message={errors.category} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} {...err("description")} />
                <FieldError id="description-error" message={errors.description} />
              </div>
            </div>
          </Section>

          <Section title="Logo" description="Shown on the organization's pages and emails.">
            <ImageDropZone label="Logo" hint="PNG, JPG or WebP, up to 5MB · saved with the form" value={form.logo} onChange={(url) => set("logo", url)} />
            <FieldError id="logo-error" message={errors.logo} />
          </Section>

          <Section title="Contact" description="How people reach the organization.">
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} {...err("email")} />
                  <FieldError id="email-error" message={errors.email} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} {...err("phone")} />
                  <FieldError id="phone-error" message={errors.phone} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" placeholder="https://" value={form.website} onChange={(e) => set("website", e.target.value)} {...err("website")} />
                <FieldError id="website-error" message={errors.website} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={form.state} onChange={(e) => set("state", e.target.value)} maxLength={80} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value)} maxLength={80} />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Status" description="Inactive organizations are hidden from their members' switcher.">
            <div className="flex items-start justify-between gap-6 rounded-lg border px-4 py-3">
              <div className="min-w-0">
                <Label htmlFor="org-active" id="org-active-label">Active</Label>
                <p id="org-active-hint" className="mt-0.5 text-[13px] text-muted-foreground">Turn off to pause the organization without deleting it.</p>
              </div>
              <Switch id="org-active" aria-labelledby="org-active-label" aria-describedby="org-active-hint" className="mt-0.5" checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
            </div>
          </Section>

          <div className="flex justify-end gap-2 border-t border-rule pt-6">
            <Link href={`/admin/enterprise/organizations/${orgId}`} className={buttonVariants({ variant: "outline" })}>Cancel</Link>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

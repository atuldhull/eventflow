"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Plus, MoreHorizontal, BadgeCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useDebounce } from "@/hooks/useDebounce"
import { statusLabel } from "@/lib/status-tone"
import { ENTERPRISE_TYPES, slugFromName } from "@/lib/enterprise-admin"
import { SearchField, TableEmpty, Initial, fmtDate, num } from "@/app/admin/enterprise/_components/admin-ui"
import { TypedConfirmDialog } from "@/app/admin/enterprise/_components/typed-confirm-dialog"
import { TransferOwnershipDialog } from "@/app/admin/enterprise/_components/transfer-ownership-dialog"

interface Enterprise {
  id: string
  name: string
  slug: string
  type: string | null
  email: string
  isActive: boolean
  isVerified: boolean
  createdAt: string
  _count: { organizations: number; events: number; members: number }
  owner: { name: string }
}

interface EnterpriseDetail extends Omit<Enterprise, "owner"> {
  description: string | null
  phone: string | null
  website: string | null
  city: string | null
  state: string | null
  country: string | null
  customDomain: string | null
  owner: { id: string; name: string; email: string }
  subscription: { plan: string; status: string } | null
}

interface EditForm { name: string; email: string; type: string; description: string; phone: string; website: string }

const TYPE_ITEMS = ENTERPRISE_TYPES.map((t) => ({ value: t, label: statusLabel(t) }))

const EMPTY_FORM = { name: "", slug: "", email: "", ownerEmail: "", type: "", description: "" }

// what GET /api/super-admin/enterprises?status= understands ("" = all)
const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Unverified" },
]

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  )
}

export default function EnterprisesPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<Enterprise[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [slugTouched, setSlugTouched] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Row actions
  const [detail, setDetail] = useState<EnterpriseDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Enterprise | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Enterprise | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Enterprise | null>(null)
  const [transferTarget, setTransferTarget] = useState<Enterprise | null>(null)
  const [statusFilter, setStatusFilter] = useState("")

  const fetchEnterprises = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/super-admin/enterprises?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        setTotal(json.pagination.total)
      }
    } catch {
      toast.error("Failed to load enterprises")
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, debouncedSearch, statusFilter])

  useEffect(() => { fetchEnterprises() }, [fetchEnterprises])

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/super-admin/enterprises/${id}`)
    const json = await res.json().catch(() => null)
    if (!json?.success) throw new Error(json?.message || "Failed to load enterprise")
    return json.data as EnterpriseDetail
  }, [])

  const openDetail = useCallback(async (e: Enterprise) => {
    setDetail(null)
    setDetailOpen(true)
    try {
      setDetail(await loadDetail(e.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load enterprise")
      setDetailOpen(false)
    }
  }, [loadDetail])

  const openEdit = useCallback(async (e: Enterprise) => {
    setEditTarget(e)
    setEditForm(null)
    try {
      const d = await loadDetail(e.id)
      setEditForm({ name: d.name, email: d.email, type: d.type || "", description: d.description || "", phone: d.phone || "", website: d.website || "" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load enterprise")
      setEditTarget(null)
    }
  }, [loadDetail])

  const toggle = useCallback(async (e: Enterprise, kind: "verify" | "status") => {
    // deactivating locks every member out: that one goes through a typed confirmation
    if (kind === "status" && e.isActive) { setDeactivateTarget(e); return }
    try {
      const res = await fetch(`/api/super-admin/enterprises/${e.id}/${kind}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "status" ? { isActive: true } : {}),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) { toast.error(json?.message || "Failed to update enterprise"); return }
      toast.success(
        kind === "verify"
          ? `${e.name} ${json.data.isVerified ? "verified" : "unverified"}`
          : `${e.name} ${json.data.isActive ? "activated" : "deactivated"}`
      )
      fetchEnterprises()
    } catch {
      toast.error("Failed to update enterprise")
    }
  }, [fetchEnterprises])

  const deactivateEnterprise = async (typed: string) => {
    if (!deactivateTarget) return
    const res = await fetch(`/api/super-admin/enterprises/${deactivateTarget.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false, confirm: typed }),
    })
    const json = await res.json().catch(() => null)
    if (!json?.success) {
      toast.error(json?.message || "Failed to deactivate enterprise")
      throw new Error("deactivate failed")
    }
    toast.success(json.message)
    fetchEnterprises()
  }

  const saveEdit = async () => {
    if (!editTarget || !editForm) return
    setSaving(true)
    try {
      const res = await fetch(`/api/super-admin/enterprises/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, email: editForm.email.trim(), website: editForm.website.trim(), type: editForm.type || null }),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) { toast.error(json?.message || "Failed to save"); return }
      toast.success("Enterprise updated")
      setEditTarget(null)
      fetchEnterprises()
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const deleteEnterprise = async (typed: string) => {
    if (!deleteTarget) return
    const res = await fetch(`/api/super-admin/enterprises/${deleteTarget.id}`, {
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
    fetchEnterprises()
  }

  const handleCreate = async () => {
    const missing: Record<string, string> = {}
    if (form.name.trim().length < 2) missing.name = "Enter the enterprise name"
    if (!form.slug.trim()) missing.slug = "Enter a slug"
    if (!form.email.trim()) missing.email = "Enter a contact email"
    if (!form.ownerEmail.trim()) missing.ownerEmail = "Enter the owner's email (they need an EventFlow account)"
    setFormErrors(missing)
    if (Object.keys(missing).length > 0) return
    setCreating(true)
    try {
      const res = await fetch("/api/super-admin/enterprises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          email: form.email.trim(),
          ownerEmail: form.ownerEmail.trim(),
          type: form.type || undefined,
          description: form.description || undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (json?.success) {
        toast.success(json.message || "Enterprise created")
        setShowCreate(false)
        setForm(EMPTY_FORM)
        setSlugTouched(false)
        setFormErrors({})
        fetchEnterprises()
      } else {
        // the API names the field it refused (slug taken, unknown owner, ...)
        const fieldErrors = (json?.errors ?? {}) as Record<string, string[] | undefined>
        const next: Record<string, string> = {}
        for (const [key, msgs] of Object.entries(fieldErrors)) if (msgs?.[0]) next[key] = msgs[0]
        setFormErrors(next)
        if (Object.keys(next).length === 0) toast.error(json?.message || "Failed to create enterprise")
      }
    } catch {
      toast.error("Failed to create enterprise")
    } finally {
      setCreating(false)
    }
  }

  /** a field's error, wired to the input for screen readers */
  const fieldError = (key: string) => formErrors[key]
    ? { "aria-invalid": true as const, "aria-describedby": `ent-${key}-error` }
    : {}
  const errorText = (field: string) =>
    formErrors[field] ? <p id={`ent-${field}-error`} className="text-[13px] text-destructive">{formErrors[field]}</p> : null

  const columns = useMemo<ColumnDef<Enterprise, unknown>[]>(() => [
    {
      accessorKey: "name",
      header: "Enterprise",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <Initial name={row.original.name} className="rounded-md" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{row.original.name}</span>
              {row.original.isVerified && <BadgeCheck className="size-4 shrink-0 text-brand" aria-label="Verified" />}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">{row.original.slug}</p>
          </div>
        </div>
      ),
      meta: { className: "min-w-[220px]" },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ getValue }) => {
        const type = getValue() as string | null
        return type ? <span className="text-muted-foreground">{statusLabel(type)}</span> : <span className="text-faint">—</span>
      },
    },
    {
      accessorKey: "owner",
      header: "Owner",
      cell: ({ row }) => <span>{row.original.owner?.name || "—"}</span>,
    },
    { id: "orgs", header: "Orgs", cell: ({ row }) => num(row.original._count?.organizations), meta: { align: "right" } },
    { id: "events", header: "Events", cell: ({ row }) => num(row.original._count?.events), meta: { align: "right" } },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => <Pill tone={row.original.isActive ? "positive" : "neutral"}>{row.original.isActive ? "Active" : "Inactive"}</Pill>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const e = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.name}`} />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openDetail(e)}>View details</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEdit(e)}>Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toggle(e, "verify")}>{e.isVerified ? "Unverify" : "Verify"}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggle(e, "status")}>{e.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTransferTarget(e)}>Transfer ownership</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(e)}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      meta: { align: "right", className: "w-12" },
    },
  ], [openDetail, openEdit, toggle])

  const setEdit = (key: keyof EditForm, value: string) => setEditForm((f) => (f ? { ...f, [key]: value } : f))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprises"
        description={isLoading && total === 0 ? "Every enterprise on the platform" : `${num(total)} enterprise${total === 1 ? "" : "s"} on the platform`}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus />
            Add enterprise
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search enterprises…" className="sm:max-w-sm" />
        <Select items={STATUS_FILTERS} value={statusFilter} onValueChange={(v) => { setStatusFilter((v as string) || ""); setPage(1) }}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-44 data-[size=default]:h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => <SelectItem key={s.value || "all"} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize, total }}
        onPaginationChange={(p, ps) => { setPage(p); setPageSize(ps) }}
        emptyState={
          <TableEmpty
            title={debouncedSearch || statusFilter ? "No matching enterprises" : "No enterprises yet"}
            description={debouncedSearch || statusFilter ? "Try a different search or filter." : "Create your first enterprise to get started."}
          />
        }
      />

      {/* Create enterprise */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setFormErrors({}) }}>
        <DialogContent className="sm:max-w-[480px]">
          <form noValidate onSubmit={(e) => { e.preventDefault(); handleCreate() }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>New enterprise</DialogTitle>
              <DialogDescription>A university, company or other group that owns organizations.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ent-name">Name</Label>
                <Input
                  id="ent-name"
                  aria-required
                  {...fieldError("name")}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugTouched ? form.slug : slugFromName(e.target.value) })}
                  placeholder="e.g. Demo University"
                />
                {errorText("name")}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ent-slug">Slug</Label>
                <Input
                  id="ent-slug"
                  className="font-mono"
                  aria-required
                  {...fieldError("slug")}
                  value={form.slug}
                  onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value.toLowerCase() }) }}
                  placeholder="demo-university"
                />
                {errorText("slug") ?? <p className="text-xs text-muted-foreground">Lowercase letters, numbers and hyphens. It can&apos;t be changed later or reused.</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ent-owner">Owner&apos;s email</Label>
                <Input id="ent-owner" type="email" autoComplete="off" aria-required {...fieldError("ownerEmail")} value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="owner@enterprise.com" />
                {errorText("ownerEmail") ?? <p className="text-xs text-muted-foreground">An existing EventFlow account. They become the owner and an enterprise admin.</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ent-email">Contact email</Label>
                <Input id="ent-email" type="email" aria-required {...fieldError("email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="events@enterprise.com" />
                {errorText("email")}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ent-type">Type</Label>
                <Select items={TYPE_ITEMS} value={form.type || null} onValueChange={(v) => setForm({ ...form, type: (v as string) || "" })}>
                  <SelectTrigger id="ent-type" className="w-full data-[size=default]:h-9">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_ITEMS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ent-description">Description</Label>
                <Input id="ent-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="animate-spin" />}
                {creating ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View details */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              {detail?.name ?? "Enterprise"}
              {detail?.isVerified && <BadgeCheck className="size-4 shrink-0 text-brand" aria-label="Verified" />}
            </DialogTitle>
            <DialogDescription>{detail ? <span className="font-mono">{detail.slug}</span> : "Loading…"}</DialogDescription>
          </DialogHeader>
          {!detail ? (
            <div className="space-y-3" aria-busy><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-3/5" /></div>
          ) : (
            <dl className="divide-y divide-rule">
              <DetailRow label="Status">
                <span className="flex flex-wrap gap-1.5">
                  <Pill tone={detail.isActive ? "positive" : "neutral"}>{detail.isActive ? "Active" : "Inactive"}</Pill>
                  <Pill tone={detail.isVerified ? "positive" : "neutral"}>{detail.isVerified ? "Verified" : "Unverified"}</Pill>
                </span>
              </DetailRow>
              <DetailRow label="Owner">{detail.owner.name} <span className="text-muted-foreground">· {detail.owner.email}</span></DetailRow>
              <DetailRow label="Contact">{detail.email}{detail.phone ? ` · ${detail.phone}` : ""}</DetailRow>
              <DetailRow label="Type">{detail.type ? statusLabel(detail.type) : "—"}</DetailRow>
              <DetailRow label="Plan">{detail.subscription ? `${statusLabel(detail.subscription.plan)} · ${statusLabel(detail.subscription.status)}` : "No subscription"}</DetailRow>
              <DetailRow label="Size">
                <span className="tabular-nums">
                  {num(detail._count.organizations)} orgs · {num(detail._count.events)} events · {num(detail._count.members)} members
                </span>
              </DetailRow>
              <DetailRow label="Custom domain">{detail.customDomain ? <span className="font-mono">{detail.customDomain}</span> : "—"}</DetailRow>
              <DetailRow label="Created">{fmtDate(detail.createdAt, true)}</DetailRow>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open && !saving) setEditTarget(null) }}>
        <DialogContent className="sm:max-w-[520px]">
          <form noValidate onSubmit={(e) => { e.preventDefault(); saveEdit() }} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Edit {editTarget?.name}</DialogTitle>
              <DialogDescription>Profile details. Status and verification have their own actions.</DialogDescription>
            </DialogHeader>
            {!editForm ? (
              <div className="space-y-3" aria-busy><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-16 w-full" /></div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input id="edit-name" value={editForm.name} maxLength={120} onChange={(e) => setEdit("name", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-type">Type</Label>
                    <Select items={TYPE_ITEMS} value={editForm.type || null} onValueChange={(v) => setEdit("type", (v as string) || "")}>
                      <SelectTrigger id="edit-type" className="w-full data-[size=default]:h-9">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_ITEMS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEdit("email", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input id="edit-phone" type="tel" value={editForm.phone} maxLength={30} onChange={(e) => setEdit("phone", e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-website">Website</Label>
                  <Input id="edit-website" type="url" placeholder="https://" value={editForm.website} onChange={(e) => setEdit("website", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea id="edit-description" rows={3} maxLength={2000} value={editForm.description} onChange={(e) => setEdit("description", e.target.value)} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving || !editForm}>
                {saving && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TypedConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={`Delete ${deleteTarget?.name ?? "enterprise"}?`}
        description="The enterprise is hidden and switched off, and its custom domain is released. Organizations, events and history are kept. The deletion is recorded in the audit log."
        confirmText={deleteTarget?.name ?? ""}
        actionLabel="Delete enterprise"
        onConfirm={deleteEnterprise}
      />

      <TypedConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => { if (!open) setDeactivateTarget(null) }}
        title={`Deactivate ${deactivateTarget?.name ?? "enterprise"}?`}
        description="Every member loses access straight away and its events disappear from the public site until you activate it again. Nothing is deleted. This is recorded in the audit log."
        confirmText={deactivateTarget?.name ?? ""}
        actionLabel="Deactivate enterprise"
        onConfirm={deactivateEnterprise}
      />

      <TransferOwnershipDialog
        open={!!transferTarget}
        onOpenChange={(open) => { if (!open) setTransferTarget(null) }}
        enterprise={transferTarget ? { id: transferTarget.id, name: transferTarget.name } : null}
        onTransferred={fetchEnterprises}
      />
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Award, Plus, MoreHorizontal, Loader2, CalendarCheck } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTable } from "@/components/tables/DataTable"
import { DataTableSearch, DataTableToolbar } from "@/components/tables/DataTableToolbar"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Pill, type Tone } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"

interface CertRow {
  id: string
  certificateNumber: string
  recipientName: string
  recipientEmail: string
  eventTitle: string
  type: string
  title: string
  status: "GENERATED" | "SENT" | "DOWNLOADED" | "REVOKED"
  issuedDate: string
  downloadedAt: string | null
  verificationCode: string
}

interface Counts { total: number; GENERATED: number; SENT: number; DOWNLOADED: number; REVOKED: number }
interface PendingEvent {
  eventId: string
  title: string
  endDate: string
  eligible: number
  issued: number
  /** how many Generate creates: checkedIn with "Checked-in only", all without */
  toGenerate?: { checkedIn: number; all: number }
}
interface Template { id: string; name: string; description: string | null; templateHtml: string; isDefault: boolean; createdAt: string; _count: { certificates: number } }

const PAGE_SIZE = 10
const STATUS_FILTERS = ["ALL", "GENERATED", "SENT", "DOWNLOADED", "REVOKED"] as const
const filterLabel = (s: string) => (s === "ALL" ? "All statuses" : statusLabel(s))
const certTone = (s: string): Tone => (s === "REVOKED" ? "negative" : statusTone(s))
const fmtDate = (v: string) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

/** The type saved by the template builder (it stores its settings as JSON). */
function templateType(t: Template) {
  try {
    const parsed = JSON.parse(t.templateHtml) as { type?: unknown }
    return typeof parsed.type === "string" ? parsed.type : null
  } catch {
    return null
  }
}

function CertificateThumb() {
  // a miniature certificate: a sheet with a ruled double frame
  return (
    <div className="border-b bg-raised p-4">
      <div className="mx-auto flex aspect-[297/210] max-w-[240px] flex-col items-center justify-center gap-1.5 rounded-[3px] bg-background p-3 ring-1 ring-border">
        <div className="flex size-full flex-col items-center justify-center gap-1.5 rounded-[2px] border-[3px] border-double border-border">
          <Award className="size-5 text-faint" strokeWidth={1.5} aria-hidden />
          <span className="h-1 w-16 rounded-full bg-muted" />
          <span className="h-1 w-10 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  )
}

function IssuedTab({ orgId, onCounts }: { orgId: string; onCounts: (c: Counts) => void }) {
  const { can } = useRBAC()
  const canManage = can(PERMISSIONS.CERTIFICATE_MANAGE)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search.trim())
  const [status, setStatus] = useState<string>("ALL")
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<CertRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [revokeTarget, setRevokeTarget] = useState<CertRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const filterKey = `${debouncedSearch}|${status}`
  const [appliedKey, setAppliedKey] = useState(filterKey)
  if (appliedKey !== filterKey) {
    setAppliedKey(filterKey)
    setPage(1)
  }

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (status !== "ALL") params.set("status", status)
      const res = await fetch(`/api/admin/org/${orgId}/certificates?${params}`)
      const json = await res.json()
      if (json.success) {
        setRows(json.data)
        setTotal(json.pagination.total)
        onCounts(json.counts)
      } else {
        toast.error(json.message || "Failed to load certificates")
      }
    } catch {
      toast.error("Failed to load certificates")
    } finally {
      setIsLoading(false)
    }
  }, [orgId, page, debouncedSearch, status, onCounts])

  useEffect(() => { load() }, [load, reloadKey])

  const act = async (cert: CertRow, request: () => Promise<Response>, done: string) => {
    setBusyId(cert.id)
    try {
      const res = await request()
      const json = await res.json().catch(() => ({}))
      if (json.success) { toast.success(json.message || done); setReloadKey((k) => k + 1) }
      else toast.error(json.message || "Something went wrong")
    } catch {
      toast.error("Something went wrong")
    } finally {
      setBusyId(null)
    }
  }

  const setRevoked = (cert: CertRow, revoke: boolean) =>
    act(
      cert,
      () => fetch(`/api/admin/org/${orgId}/certificates/${cert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: revoke ? "revoke" : "restore" }),
      }),
      revoke ? "Certificate revoked" : "Certificate restored"
    )

  const resend = (cert: CertRow) =>
    act(cert, () => fetch(`/api/admin/org/${orgId}/certificates/${cert.id}/resend`, { method: "POST" }), "Certificate sent")

  const copyVerifyLink = async (cert: CertRow) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/verify/${encodeURIComponent(cert.verificationCode)}`)
      toast.success("Verification link copied")
    } catch {
      toast.error("Couldn't copy the link")
    }
  }

  const columns: ColumnDef<CertRow, unknown>[] = [
    {
      accessorKey: "recipientName", header: "Recipient",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.recipientName}</p>
          <p className="truncate text-[13px] text-muted-foreground">{row.original.recipientEmail}</p>
        </div>
      ),
      meta: { className: "min-w-[200px]" },
    },
    { accessorKey: "eventTitle", header: "Event", cell: ({ getValue }) => <span className="block max-w-[240px] truncate">{getValue() as string}</span> },
    { accessorKey: "certificateNumber", header: "Certificate", cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue() as string}</span> },
    { accessorKey: "type", header: "Type", cell: ({ getValue }) => <Pill>{statusLabel(getValue() as string)}</Pill> },
    {
      accessorKey: "status", header: "Status",
      cell: ({ getValue }) => {
        const s = getValue() as string
        return <Pill tone={certTone(s)}>{statusLabel(s)}</Pill>
      },
    },
    { accessorKey: "issuedDate", header: "Issued", cell: ({ getValue }) => <span className="text-muted-foreground">{fmtDate(getValue() as string)}</span> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { align: "right", className: "w-12" },
      cell: ({ row }) => {
        const c = row.original
        const revoked = c.status === "REVOKED"
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.recipientName}'s certificate`} className="text-muted-foreground" disabled={busyId === c.id} />}
            >
              {busyId === c.id ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<a href={`/api/certificates/${c.id}/download`} download />}>
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`/api/certificates/${c.id}/download?format=html`, "_blank", "noopener")}>
                Open printable page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyVerifyLink(c)}>Copy verification link</DropdownMenuItem>
              {canManage && !revoked && <DropdownMenuItem onClick={() => resend(c)}>Email to recipient</DropdownMenuItem>}
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  {revoked ? (
                    <DropdownMenuItem onClick={() => setRevoked(c, false)}>Restore</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" onClick={() => setRevokeTarget(c)}>Revoke</DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const isFiltered = Boolean(debouncedSearch) || status !== "ALL"

  return (
    <div className="space-y-3">
      <DataTableToolbar>
        <DataTableSearch placeholder="Search recipients or events" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onValueChange={(v) => setStatus(v || "ALL")}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-44">
            <SelectValue>{(v: string) => filterLabel(v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => <SelectItem key={s} value={s}>{filterLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </DataTableToolbar>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPaginationChange={(p) => setPage(p)}
        emptyState={
          isFiltered ? (
            <EmptyState icon={Award} title="No matching certificates" description="Try another search or status." className="border-0 py-6" />
          ) : (
            <EmptyState icon={Award} title="No certificates issued yet" description="Generate certificates for finished events from Pending." className="border-0 py-6" />
          )
        }
      />

      <Dialog open={revokeTarget !== null} onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this certificate?</DialogTitle>
            <DialogDescription>
              {revokeTarget && `${revokeTarget.recipientName}'s certificate ${revokeTarget.certificateNumber} will show as revoked on the verification page and can no longer be downloaded. You can restore it later.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={() => { if (revokeTarget) setRevoked(revokeTarget, true); setRevokeTarget(null) }}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PendingTab({ orgId, onGenerated }: { orgId: string; onGenerated: () => void }) {
  const [events, setEvents] = useState<PendingEvent[]>([])
  const [templates, setTemplates] = useState<{ id: string; name: string; isDefault: boolean }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/org/${orgId}/certificates/pending`)
        const json = await res.json()
        if (cancelled) return
        if (json.success) { setEvents(json.data); setTemplates(json.templates) }
        else toast.error(json.message || "Failed to load events")
      } catch {
        if (!cancelled) toast.error("Failed to load events")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [orgId, reloadKey])

  // Generate asks first: who gets one (checked-in only by default, so no-shows don't) and how many.
  const [confirmFor, setConfirmFor] = useState<PendingEvent | null>(null)
  const [checkedInOnly, setCheckedInOnly] = useState(true)
  const countFor = (ev: PendingEvent, onlyCheckedIn: boolean) =>
    ev.toGenerate ? (onlyCheckedIn ? ev.toGenerate.checkedIn : ev.toGenerate.all) : Math.max(0, ev.eligible - ev.issued)

  const generate = async (ev: PendingEvent, onlyCheckedIn: boolean) => {
    setBusyId(ev.eventId)
    try {
      const res = await fetch(`/api/admin/org/${orgId}/certificates/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: ev.eventId, recipientFilter: onlyCheckedIn ? "checked_in_only" : "all_confirmed" }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
        setConfirmFor(null)
        setReloadKey((k) => k + 1)
        onGenerated()
      } else toast.error(json.message || "Failed to generate certificates")
    } catch {
      toast.error("Failed to generate certificates")
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading events">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    )
  }
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Nothing waiting for certificates"
        description="Finished events with participants who don't have a certificate yet appear here."
      />
    )
  }

  const template = templates.find((t) => t.isDefault) ?? templates[0]

  return (
    <div className="space-y-3">
      {!template && (
        <p className="rounded-lg border px-4 py-3 text-[13px] text-muted-foreground">
          Create a certificate template before generating certificates.{" "}
          <Link href="/admin/org/certificates/templates/create" className="font-medium text-foreground underline underline-offset-2">Create template</Link>
        </p>
      )}
      <ul className="divide-y divide-rule overflow-hidden rounded-lg border">
        {events.map((ev) => (
          <li key={ev.eventId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{ev.title}</p>
              <p className="text-[13px] text-muted-foreground tabular-nums">
                Ended {fmtDate(ev.endDate)} · {ev.issued.toLocaleString("en-IN")} of {ev.eligible.toLocaleString("en-IN")} participants have one
              </p>
            </div>
            <PermissionGate permission={PERMISSIONS.CERTIFICATE_GENERATE}>
              <Button
                variant="outline"
                size="sm"
                className="max-sm:w-full"
                disabled={!template || busyId !== null}
                onClick={() => { setCheckedInOnly(true); setConfirmFor(ev) }}
                title={template ? `Uses “${template.name}”` : undefined}
              >
                {busyId === ev.eventId && <Loader2 className="animate-spin" />}
                Generate…
              </Button>
            </PermissionGate>
          </li>
        ))}
      </ul>

      <Dialog open={confirmFor !== null} onOpenChange={(o) => { if (!o && busyId === null) setConfirmFor(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate certificates for {confirmFor?.title}?</DialogTitle>
            <DialogDescription>
              {template ? `Uses the “${template.name}” template. ` : ""}Participants who already have a certificate for this event are skipped.
            </DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Checked-in only</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">
                Leave out confirmed registrants who never checked in (no-shows).
              </span>
            </span>
            <Switch checked={checkedInOnly} onCheckedChange={(v) => setCheckedInOnly(Boolean(v))} aria-label="Checked-in only" />
          </label>
          {confirmFor && (
            <p className="text-sm" role="status">
              <span className="font-semibold tabular-nums">{countFor(confirmFor, checkedInOnly).toLocaleString("en-IN")}</span>{" "}
              {countFor(confirmFor, checkedInOnly) === 1 ? "certificate" : "certificates"} will be generated
              {confirmFor.toGenerate && checkedInOnly && confirmFor.toGenerate.all > confirmFor.toGenerate.checkedIn && (
                <span className="text-muted-foreground">
                  {" "}({(confirmFor.toGenerate.all - confirmFor.toGenerate.checkedIn).toLocaleString("en-IN")} without a check-in left out)
                </span>
              )}
              .
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={busyId !== null} />}>Cancel</DialogClose>
            <Button
              disabled={busyId !== null || !confirmFor || countFor(confirmFor, checkedInOnly) === 0}
              onClick={() => confirmFor && void generate(confirmFor, checkedInOnly)}
            >
              {busyId !== null && <Loader2 className="animate-spin" />}
              Generate {confirmFor ? countFor(confirmFor, checkedInOnly).toLocaleString("en-IN") : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TemplatesTab({ orgId }: { orgId: string }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/org/${orgId}/certificates/templates`)
        const json = await res.json()
        if (cancelled) return
        if (json.success) setTemplates(json.data)
        else toast.error(json.message || "Failed to load templates")
      } catch {
        if (!cancelled) toast.error("Failed to load templates")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading templates">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
      </div>
    )
  }
  if (templates.length === 0) {
    return (
      <EmptyState icon={Award} title="No templates yet" description="A template sets the title and wording of the certificates you issue.">
        <PermissionGate permission={PERMISSIONS.CERTIFICATE_CREATE_TEMPLATE}>
          <Link href="/admin/org/certificates/templates/create" className={cn(buttonVariants())}>
            <Plus /> Create template
          </Link>
        </PermissionGate>
      </EmptyState>
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => {
        const type = templateType(t)
        return (
          <li key={t.id}>
            <Card className="gap-0 p-0">
              <CertificateThumb />
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  {t.isDefault && <Pill tone="brand">Default</Pill>}
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
                  {[type, `${t._count.certificates.toLocaleString("en-IN")} issued`].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

export default function CertificatesPage() {
  const { currentOrganizationId } = useRBAC()
  const [tab, setTab] = useState("issued")
  const [counts, setCounts] = useState<Counts | null>(null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        description="Issue, send and verify event certificates"
        actions={
          <PermissionGate permission={PERMISSIONS.CERTIFICATE_CREATE_TEMPLATE}>
            <Link href="/admin/org/certificates/templates/create" className={cn(buttonVariants())}>
              <Plus /> Create template
            </Link>
          </PermissionGate>
        }
      />

      <KpiStrip
        isLoading={counts === null}
        items={[
          { label: "Issued", value: (counts?.total ?? 0).toLocaleString("en-IN") },
          { label: "Emailed", value: (counts?.SENT ?? 0).toLocaleString("en-IN") },
          { label: "Downloaded", value: (counts?.DOWNLOADED ?? 0).toLocaleString("en-IN") },
          { label: "Revoked", value: (counts?.REVOKED ?? 0).toLocaleString("en-IN") },
        ]}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-5">
        <TabsList variant="line">
          <TabsTrigger value="issued">Issued</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {currentOrganizationId && (
          <>
            <TabsContent value="issued">
              <IssuedTab orgId={currentOrganizationId} onCounts={setCounts} />
            </TabsContent>
            <TabsContent value="pending">
              <PendingTab orgId={currentOrganizationId} onGenerated={() => setTab("issued")} />
            </TabsContent>
            <TabsContent value="templates">
              <TemplatesTab orgId={currentOrganizationId} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

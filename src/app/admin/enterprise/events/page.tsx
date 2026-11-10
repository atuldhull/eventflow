"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Loader2, MoreHorizontal, Star } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Pill } from "@/components/ui/pill"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useRBAC } from "@/hooks/useRBAC"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/permissions"
import { useDebounce } from "@/hooks/useDebounce"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { SearchField, TableEmpty, PrimaryCell, CapacityCell, fmtDate, num } from "../_components/admin-ui"

interface EventRow {
  id: string
  title: string
  organization: string
  category: string | null
  status: string
  startDate: string
  currentRegistrations: number
  maxCapacity: number | null
  isPaid: boolean
  isFeatured: boolean
  approvalDecision: { status: "APPROVED" | "REJECTED"; reason: string | null; decidedAt: string } | null
}

interface Counts { total: number; pending: number; published: number; ongoing: number; completed: number; draft: number }

type Tab = "all" | "pending"
const PAGE_SIZE = 10
const EMPTY_COUNTS: Counts = { total: 0, pending: 0, published: 0, ongoing: 0, completed: 0, draft: 0 }

const baseColumns: ColumnDef<EventRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => (
      <PrimaryCell title={row.original.title} meta={row.original.organization}>
        {row.original.isFeatured && (
          <Star className="size-3.5 shrink-0 fill-current text-warning" aria-label="Featured" />
        )}
      </PrimaryCell>
    ),
    meta: { className: "min-w-[240px]" },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ getValue }) => {
      const cat = getValue() as string | null
      return cat ? <span className="text-muted-foreground">{statusLabel(cat)}</span> : <span className="text-faint">—</span>
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const e = row.original
      const rejected = e.status === "DRAFT" && e.approvalDecision?.status === "REJECTED"
      return (
        <div className="flex flex-col items-start gap-1">
          <Pill tone={rejected ? "negative" : statusTone(e.status)}>{rejected ? "Not approved" : statusLabel(e.status)}</Pill>
          {rejected && e.approvalDecision?.reason && (
            <span className="line-clamp-2 max-w-[260px] text-xs text-muted-foreground">{e.approvalDecision.reason}</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "startDate",
    header: "Date",
    cell: ({ getValue }) => <span className="text-muted-foreground">{fmtDate(getValue() as string, true)}</span>,
  },
  {
    id: "registrations",
    header: "Registrations",
    cell: ({ row }) => <CapacityCell count={row.original.currentRegistrations} capacity={row.original.maxCapacity} />,
    meta: { align: "right" },
  },
]

export default function EnterpriseEventsPage() {
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const { accessibleEnterprises, currentEnterpriseId } = useRBAC()
  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)

  const [events, setEvents] = useState<EventRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [isLoading, setIsLoading] = useState(true)
  const { hasPermission } = usePermissions()
  const canApprove = hasPermission(PERMISSIONS.EVENT_PUBLISH)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<EventRow[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  // one event (row action) or the selected ones (bulk): the same reason goes to each
  const [rejectTarget, setRejectTarget] = useState<EventRow[] | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectError, setRejectError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!currentEnterpriseId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (tab === "pending") params.set("status", "PENDING_APPROVAL")
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/events?${params}`)
      const json = await res.json()
      if (json.success) {
        setEvents(json.data)
        setTotal(json.pagination.total)
        setCounts(json.counts ?? EMPTY_COUNTS)
        setSelected([])
      } else toast.error(json.message || "Failed to load events")
    } catch { toast.error("Failed to load events") } finally { setIsLoading(false) }
  }, [currentEnterpriseId, page, debouncedSearch, tab])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Events sent for approval (enterprise setting "Require event approval")
  const approve = useCallback(async (event: EventRow) => {
    if (!currentEnterpriseId) return
    setBusyId(event.id)
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/events/${event.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.success) { toast.success(json.message || `${event.title} is published`); fetchEvents() }
      // e.g. a paid event while payments are off: the reason stays up long enough to read
      else toast.error(json.message || "Something went wrong", { duration: 12000 })
    } catch { toast.error("Something went wrong") } finally { setBusyId(null) }
  }, [currentEnterpriseId, fetchEvents])

  const openReject = (targets: EventRow[]) => {
    setRejectReason("")
    setRejectError(null)
    setRejectTarget(targets)
  }

  /**
   * Several events at once (POST …/events/bulk-decision): each one is decided like a single
   * one, and the answer has a result per event. The toast sums it up ("Approved 4 of 5 — 1
   * failed: <reason>"); a partial result stays up long enough to read. Returns false when the
   * request itself was refused (e.g. the reason), so the reject dialog can show why.
   */
  const bulkDecide = async (action: "approve" | "reject", targets: EventRow[], reason?: string): Promise<boolean> => {
    if (!currentEnterpriseId || targets.length === 0) return false
    setBulkBusy(true)
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/events/bulk-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, eventIds: targets.map((e) => e.id), reason }),
      })
      const json = await res.json().catch(() => ({}))
      const results = (json.data?.results ?? null) as { ok: boolean }[] | null
      if (!results) {
        if (action === "reject") setRejectError(json.message || "Something went wrong")
        else toast.error(json.message || "Something went wrong", { duration: 12000 })
        return false
      }
      const failed = results.filter((r) => !r.ok).length
      if (failed === 0) toast.success(json.message)
      else if (failed < results.length) toast.warning(json.message, { duration: 12000 })
      else toast.error(json.message, { duration: 12000 })
      fetchEvents()
      return true
    } catch {
      if (action === "reject") setRejectError("Couldn't reach the server")
      else toast.error("Couldn't reach the server")
      return false
    } finally { setBulkBusy(false) }
  }

  const submitReject = async () => {
    if (!currentEnterpriseId || !rejectTarget || rejectTarget.length === 0) return
    const reason = rejectReason.trim()
    if (reason.length < 3) { setRejectError("Tell the organization why (at least 3 characters)"); return }

    if (rejectTarget.length > 1) {
      if (await bulkDecide("reject", rejectTarget, reason)) { setRejectTarget(null); setRejectReason("") }
      return
    }

    const [target] = rejectTarget
    setBusyId(target.id)
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/events/${target.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json.success) { setRejectError(json.message || "Something went wrong"); return }
      toast.success(json.message || `${target.title} was sent back to draft`)
      setRejectTarget(null)
      setRejectReason("")
      fetchEvents()
    } catch { setRejectError("Couldn't reach the server") } finally { setBusyId(null) }
  }

  // the approve / reject column only when a row on screen is waiting for a decision
  const hasPending = events.some((e) => e.status === "PENDING_APPROVAL")
  const tableColumns = useMemo<ColumnDef<EventRow, unknown>[]>(() => canApprove && hasPending ? [
    ...baseColumns,
    {
      id: "approval",
      header: () => <span className="sr-only">Approval</span>,
      // phones: one "⋯" menu, pinned to the table's right edge (two buttons would need sideways scrolling)
      meta: { align: "right", stickyRight: true },
      cell: ({ row }) => {
        if (row.original.status !== "PENDING_APPROVAL") return null
        const busy = busyId === row.original.id || bulkBusy
        return (
          <>
            <div className="hidden justify-end gap-1.5 md:flex">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => approve(row.original)}>Approve</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => openReject([row.original])}>Reject</Button>
            </div>
            <div className="flex justify-end md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`Actions for ${row.original.title}`} />}>
                  {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => approve(row.original)}>Approve</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => openReject([row.original])}>Reject…</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )
      },
    },
  ] : baseColumns, [canApprove, hasPending, busyId, bulkBusy, approve])

  const pendingTab = tab === "pending"
  const rejectBusy = !!rejectTarget && (bulkBusy || (rejectTarget.length === 1 && busyId === rejectTarget[0].id))

  return (
    <div className="space-y-6">
      <PageHeader title="Events" description={`All events across ${enterprise?.name || "your enterprise"}`} />
      <KpiStrip
        isLoading={isLoading && counts.total === 0}
        items={[
          { label: "Total", value: num(counts.total) },
          { label: "Pending approval", value: num(counts.pending) },
          { label: "Published", value: num(counts.published) },
          { label: "Ongoing", value: num(counts.ongoing) },
          { label: "Completed", value: num(counts.completed) },
        ]}
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setPage(1) }}>
        <TabsList variant="line">
          <TabsTrigger value="all">All events <span className="ml-1 text-muted-foreground tabular-nums">{num(counts.total)}</span></TabsTrigger>
          <TabsTrigger value="pending">
            Pending approval
            {counts.pending > 0
              ? <Pill tone="warning" className="ml-1.5 tabular-nums">{num(counts.pending)}</Pill>
              : <span className="ml-1 text-muted-foreground tabular-nums">0</span>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search events…" className="sm:max-w-sm" />
        {pendingTab && canApprove && selected.length > 0 && (
          <div className="flex gap-2 sm:ml-auto" role="group" aria-label={`${selected.length} selected`}>
            <Button className="flex-1 sm:flex-none" onClick={() => bulkDecide("approve", selected)} disabled={bulkBusy}>
              {bulkBusy && !rejectTarget && <Loader2 className="animate-spin" />}
              Approve {selected.length} selected
            </Button>
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => openReject(selected)} disabled={bulkBusy}>
              Reject {selected.length} selected
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={tableColumns}
        data={events}
        isLoading={isLoading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPaginationChange={(p) => setPage(p)}
        enableRowSelection={pendingTab && canApprove}
        onRowSelectionChange={setSelected}
        emptyState={
          pendingTab
            ? <TableEmpty title={debouncedSearch ? "No matching events" : "Nothing waiting for approval"} description={debouncedSearch ? "Try a different search." : "Events sent for approval appear here."} />
            : <TableEmpty title={debouncedSearch ? "No matching events" : "No events yet"} description={debouncedSearch ? "Try a different search." : undefined} />
        }
      />

      {/* Reject: the reason is required, stored on the event and sent to the organization */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open && !rejectBusy) setRejectTarget(null) }}>
        <DialogContent className="sm:max-w-[460px]">
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitReject() }} className="grid gap-4">
            <DialogHeader>
              {rejectTarget && rejectTarget.length > 1 ? (
                <>
                  <DialogTitle>Reject {rejectTarget.length} events?</DialogTitle>
                  <DialogDescription>
                    They go back to draft. Each organizer sees the same reason and can fix their event and send it again.
                  </DialogDescription>
                </>
              ) : (
                <>
                  <DialogTitle>Reject {rejectTarget?.[0]?.title}?</DialogTitle>
                  <DialogDescription>
                    It goes back to draft. {rejectTarget?.[0]?.organization && rejectTarget[0].organization !== "Direct" ? rejectTarget[0].organization : "The organizer"} sees your reason and can fix the event and send it again.
                  </DialogDescription>
                </>
              )}
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="reject-reason">Reason</Label>
              <Textarea
                id="reject-reason"
                rows={3}
                maxLength={500}
                placeholder="e.g. Add the venue booking and a refund policy"
                value={rejectReason}
                onChange={(e) => { setRejectReason(e.target.value); setRejectError(null) }}
                aria-invalid={rejectError ? true : undefined}
                aria-describedby={rejectError ? "reject-error" : undefined}
              />
              {rejectError && <p id="reject-error" role="alert" className="text-[13px] text-destructive">{rejectError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)} disabled={rejectBusy}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={rejectBusy || rejectReason.trim().length < 3}>
                {rejectBusy && <Loader2 className="animate-spin" />}
                {rejectTarget && rejectTarget.length > 1 ? `Reject ${rejectTarget.length} events` : "Reject event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

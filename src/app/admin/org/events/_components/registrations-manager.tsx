"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { KpiStrip } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/pill"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDebounce } from "@/hooks/useDebounce"
import { statusLabel, statusTone } from "@/lib/status-tone"
import {
  RegistrationRowActions,
  RemoveRegistrationDialog,
  useRegistrationStatus,
  type RegistrationRow,
} from "./registration-admin"

const STATUS_FILTERS = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "WAITLISTED", label: "Waitlisted" },
  { value: "CHECKED_IN", label: "Checked in" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REJECTED", label: "Rejected" },
] as const

const PAGE_SIZE = 20

interface Stats { total: number; confirmed: number; pending: number; checkedIn: number; waitlisted: number; cancelled: number }
const EMPTY_STATS: Stats = { total: 0, confirmed: 0, pending: 0, checkedIn: 0, waitlisted: 0, cancelled: 0 }

/**
 * Numbers, search, status filter, table and approve / reject / cancel for an
 * organization's registrations: all of them, or one event's (`eventId`). Search and the
 * status filter run on the server (GET /api/admin/org/:orgId/registrations).
 */
export function RegistrationsManager({
  orgId,
  eventId,
  initialStatus,
  refreshKey = 0,
}: {
  orgId: string | null | undefined
  eventId?: string
  initialStatus?: string | null
  /** Bump to reload (e.g. after a participant is added). */
  refreshKey?: number
}) {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [status, setStatus] = useState<string>(
    STATUS_FILTERS.some((s) => s.value === initialStatus) ? (initialStatus as string) : "ALL"
  )
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RegistrationRow[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [toRemove, setToRemove] = useState<{ row: RegistrationRow; action: "REJECTED" | "CANCELLED" } | null>(null)

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim())
    if (status !== "ALL") p.set("status", status)
    if (eventId) p.set("eventId", eventId)
    return p.toString()
  }, [page, debouncedSearch, status, eventId])
  const requestKey = `${orgId}?${query}#${refreshKey}.${reload}`

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/org/${orgId}/registrations?${query}`)
        const json = await res.json()
        if (cancelled) return
        if (json.success) {
          setData(json.data)
          setTotal(json.pagination.total)
          setStats({ ...EMPTY_STATS, ...json.stats })
        } else {
          toast.error(json.message || "Failed to load registrations")
        }
      } catch {
        if (!cancelled) toast.error("Failed to load registrations")
      } finally {
        if (!cancelled) setLoadedKey(requestKey)
      }
    })()
    return () => { cancelled = true }
  }, [orgId, query, requestKey])

  const isLoading = loadedKey !== requestKey
  const refresh = useCallback(() => setReload((n) => n + 1), [])
  const { update, busyId } = useRegistrationStatus(orgId, refresh)

  const columns = useMemo<ColumnDef<RegistrationRow, unknown>[]>(() => [
    {
      accessorKey: "participantName",
      header: "Participant",
      meta: { className: "min-w-[200px]" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.participantName}</p>
          <p className="truncate text-[13px] text-muted-foreground">{row.original.participantEmail}</p>
        </div>
      ),
    },
    ...(eventId
      ? []
      : [{ accessorKey: "eventTitle", header: "Event", meta: { className: "max-w-[220px]" }, cell: ({ getValue }) => <span className="block truncate">{getValue() as string}</span> } as ColumnDef<RegistrationRow, unknown>]),
    { accessorKey: "registrationNumber", header: "Reg #", meta: { className: "max-md:hidden" }, cell: ({ getValue }) => <span className="font-mono text-[13px]">{getValue() as string}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => { const s = getValue() as string; return <Pill tone={statusTone(s)}>{statusLabel(s)}</Pill> } },
    { accessorKey: "ticketType", header: "Ticket", meta: { className: "max-lg:hidden" }, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "amount", header: "Amount", meta: { align: "right", className: "max-sm:hidden" }, cell: ({ getValue }) => { const a = getValue() as number; return <span className="tabular-nums">{a > 0 ? `₹${a.toLocaleString("en-IN")}` : "Free"}</span> } },
    { accessorKey: "createdAt", header: "Date", meta: { align: "right", className: "max-sm:hidden" }, cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{new Date(getValue() as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { align: "right", className: "w-[168px]" },
      cell: ({ row }) => (
        <RegistrationRowActions
          row={row.original}
          busy={busyId === row.original.id}
          onApprove={(r) => void update(r.id, "CONFIRMED")}
          onReject={(r) => setToRemove({ row: r, action: "REJECTED" })}
          onCancel={(r) => setToRemove({ row: r, action: "CANCELLED" })}
        />
      ),
    },
  ], [eventId, busyId, update])

  const filtered = !!debouncedSearch.trim() || status !== "ALL"

  return (
    <div className="space-y-6">
      <KpiStrip
        isLoading={isLoading && stats.total === 0 && loadedKey === null}
        items={[
          { label: "Total", value: stats.total.toLocaleString("en-IN") },
          { label: "Confirmed", value: stats.confirmed.toLocaleString("en-IN"), caption: stats.waitlisted ? `${stats.waitlisted.toLocaleString("en-IN")} waitlisted` : undefined },
          { label: "Pending", value: stats.pending.toLocaleString("en-IN"), caption: stats.pending ? "awaiting approval or payment" : undefined },
          { label: "Checked in", value: stats.checkedIn.toLocaleString("en-IN") },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            type="search"
            aria-label="Search registrations"
            placeholder="Search by name, email, or registration #…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v || "ALL"); setPage(1) }}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-44">
            <SelectValue>{(v: string) => STATUS_FILTERS.find((s) => s.value === v)?.label ?? "All statuses"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPaginationChange={(p) => setPage(p)}
        emptyState={
          <div className="py-4">
            <p className="text-[15px] font-medium">{filtered ? "No registrations match" : "No registrations yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered ? "Try a different search or status." : "Registrations will appear when participants sign up."}
            </p>
          </div>
        }
      />

      <RemoveRegistrationDialog
        target={toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={(row, action, reason) => update(row.id, action, reason)}
      />
    </div>
  )
}

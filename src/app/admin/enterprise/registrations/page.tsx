"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Pill } from "@/components/ui/pill"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { SearchField, TableEmpty, PrimaryCell, fmtDate, inr, num } from "../_components/admin-ui"
import { ExportButton } from "../_components/export-button"

interface RegRow { id: string; registrationNumber: string; participantName: string; participantEmail: string; eventTitle: string; organization: string; status: string; ticketType: string; amount: number; createdAt: string }

const columns: ColumnDef<RegRow, unknown>[] = [
  {
    accessorKey: "participantName",
    header: "Participant",
    cell: ({ row }) => <PrimaryCell title={row.original.participantName} meta={row.original.participantEmail} />,
    meta: { className: "min-w-[200px] max-w-[280px]" },
  },
  {
    accessorKey: "eventTitle",
    header: "Event",
    cell: ({ row }) => <PrimaryCell title={<span className="font-normal">{row.original.eventTitle}</span>} meta={row.original.organization} />,
    meta: { className: "min-w-[180px] max-w-[300px]" },
  },
  {
    accessorKey: "registrationNumber",
    header: "Registration",
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => { const s = getValue() as string; return <Pill tone={statusTone(s)}>{statusLabel(s)}</Pill> },
  },
  {
    accessorKey: "ticketType",
    header: "Ticket",
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ getValue }) => <span className="text-muted-foreground">{fmtDate(getValue() as string)}</span>,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ getValue }) => { const a = getValue() as number; return a > 0 ? <span className="font-medium">{inr(a)}</span> : <span className="text-muted-foreground">Free</span> },
    meta: { align: "right" },
  },
]

export default function EnterpriseRegistrationsPage() {
  const { currentEnterpriseId } = useRBAC()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RegRow[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, checkedIn: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentEnterpriseId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/registrations?${params}`)
      const json = await res.json()
      if (json.success) { setData(json.data); setTotal(json.pagination.total); setStats(json.stats) }
    } catch { toast.error("Failed to load") } finally { setIsLoading(false) }
  }, [currentEnterpriseId, page, debouncedSearch])

  const exportUrl = currentEnterpriseId
    ? `/api/admin/enterprise/${currentEnterpriseId}/registrations/export${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`
    : ""

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        description="Every registration across your enterprise"
        actions={
          exportUrl ? (
            <PermissionGate permission={PERMISSIONS.REGISTRATION_EXPORT}>
              <ExportButton url={exportUrl} fallbackName="registrations.csv" />
            </PermissionGate>
          ) : null
        }
      />
      <KpiStrip
        items={[
          { label: "Total", value: num(stats.total) },
          { label: "Confirmed", value: num(stats.confirmed) },
          { label: "Pending", value: num(stats.pending) },
          { label: "Checked in", value: num(stats.checkedIn) },
        ]}
      />
      <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search by name, email or registration number…" className="sm:max-w-sm" />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize: 20, total }}
        onPaginationChange={(p) => setPage(p)}
        emptyState={<TableEmpty title={debouncedSearch ? "No matching registrations" : "No registrations yet"} description={debouncedSearch ? "Try a different search." : undefined} />}
      />
    </div>
  )
}

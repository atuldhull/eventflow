"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Star } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Pill } from "@/components/ui/pill"
import { useDebounce } from "@/hooks/useDebounce"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { SearchField, TableEmpty, PrimaryCell, CapacityCell, fmtDate, num } from "@/app/admin/enterprise/_components/admin-ui"

interface EventRow { id: string; title: string; organization: string; enterprise: string; category: string | null; status: string; startDate: string; currentRegistrations: number; maxCapacity: number | null; isPaid: boolean; isFeatured: boolean }

const columns: ColumnDef<EventRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => (
      <PrimaryCell title={row.original.title} meta={`${row.original.organization} · ${row.original.enterprise}`}>
        {row.original.isFeatured && <Star className="size-3.5 shrink-0 fill-current text-warning" aria-label="Featured" />}
      </PrimaryCell>
    ),
    meta: { className: "min-w-[240px] max-w-[360px]" },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ getValue }) => { const c = getValue() as string | null; return c ? <span className="text-muted-foreground">{statusLabel(c)}</span> : <span className="text-faint">—</span> },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => { const s = getValue() as string; return <Pill tone={statusTone(s)}>{statusLabel(s)}</Pill> },
  },
  {
    accessorKey: "startDate",
    header: "Date",
    cell: ({ getValue }) => <span className="text-muted-foreground">{fmtDate(getValue() as string, true)}</span>,
  },
  {
    id: "type",
    header: "Type",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.isPaid ? "Paid" : "Free"}</span>,
  },
  {
    id: "registrations",
    header: "Registrations",
    cell: ({ row }) => <CapacityCell count={row.original.currentRegistrations} capacity={row.original.maxCapacity} />,
    meta: { align: "right" },
  },
]

export default function SuperAdminEventsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<EventRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<{ total: number; active: number; completed: number } | null>(null)

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/super-admin/events?${params}`)
      const json = await res.json()
      if (json.success) { setData(json.data); setTotal(json.pagination.total); if (json.stats) setStats(json.stats) }
    } catch { toast.error("Failed to load") } finally { setIsLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  return (
    <div className="space-y-6">
      <PageHeader title="Events" description="Events across the entire platform" />
      <KpiStrip
        isLoading={!stats}
        items={[
          { label: "Total events", value: num(stats?.total) },
          { label: "Active", value: num(stats?.active), caption: "Published, open or ongoing" },
          { label: "Completed", value: num(stats?.completed) },
        ]}
      />
      <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search events…" />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize: 20, total }}
        onPaginationChange={(p) => setPage(p)}
        emptyState={<TableEmpty title={debouncedSearch ? "No matching events" : "No events yet"} description={debouncedSearch ? "Try a different search." : undefined} />}
      />
    </div>
  )
}

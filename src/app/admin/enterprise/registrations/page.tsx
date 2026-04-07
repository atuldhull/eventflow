"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { ClipboardList, Download } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"

interface RegRow { id: string; registrationNumber: string; participantName: string; participantEmail: string; eventTitle: string; organization: string; status: string; ticketType: string; amount: number; createdAt: string }
const statusColors: Record<string, string> = { PENDING: "bg-amber-100 text-amber-700", CONFIRMED: "bg-green-100 text-green-700", CHECKED_IN: "bg-emerald-100 text-emerald-700", CANCELLED: "bg-red-100 text-red-700" }

const columns: ColumnDef<RegRow, unknown>[] = [
  { accessorKey: "participantName", header: "Participant", cell: ({ row }) => (<div><p className="font-medium">{row.original.participantName}</p><p className="text-xs text-muted-foreground">{row.original.participantEmail}</p></div>) },
  { accessorKey: "eventTitle", header: "Event", cell: ({ row }) => (<div><p className="text-sm">{row.original.eventTitle}</p><p className="text-xs text-muted-foreground">{row.original.organization}</p></div>) },
  { accessorKey: "registrationNumber", header: "Reg #", cell: ({ getValue }) => <span className="text-sm font-mono">{getValue() as string}</span> },
  { accessorKey: "status", header: "Status", cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant="secondary" className={statusColors[s] || ""}>{s.replace(/_/g, " ")}</Badge> } },
  { accessorKey: "ticketType", header: "Ticket", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => { const a = getValue() as number; return <span className="text-sm">{a > 0 ? `₹${a}` : "Free"}</span> } },
  { accessorKey: "createdAt", header: "Date", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{new Date(getValue() as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span> },
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

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader title="Registrations" description="All registrations across your enterprise" breadcrumbs={[{ label: "Admin" }, { label: "Enterprise", href: "/admin/enterprise" }, { label: "Registrations" }]} />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total" value={String(stats.total)} icon={ClipboardList} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Confirmed" value={String(stats.confirmed)} icon={ClipboardList} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Pending" value={String(stats.pending)} icon={ClipboardList} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatCard title="Checked In" value={String(stats.checkedIn)} icon={ClipboardList} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
      </div>
      <Input placeholder="Search by name, email, or registration #..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DataTable columns={columns} data={data} isLoading={isLoading} pagination={{ page, pageSize: 20, total }} onPaginationChange={(p) => setPage(p)}
        emptyState={<div className="text-center py-4"><ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No registrations yet</p></div>}
      />
    </div>
  )
}

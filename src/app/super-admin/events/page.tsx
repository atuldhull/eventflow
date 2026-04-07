"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Calendar, Star } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/useDebounce"

interface EventRow { id: string; title: string; organization: string; enterprise: string; category: string | null; status: string; startDate: string; currentRegistrations: number; maxCapacity: number | null; isPaid: boolean; isFeatured: boolean }
const statusColors: Record<string, string> = { DRAFT: "bg-zinc-100 text-zinc-700", PUBLISHED: "bg-blue-100 text-blue-700", ONGOING: "bg-emerald-100 text-emerald-700", COMPLETED: "bg-purple-100 text-purple-700", CANCELLED: "bg-red-100 text-red-700" }

const columns: ColumnDef<EventRow, unknown>[] = [
  { accessorKey: "title", header: "Event", cell: ({ row }) => (<div className="flex items-center gap-2"><div><p className="font-medium">{row.original.title}</p><p className="text-xs text-muted-foreground">{row.original.organization} · {row.original.enterprise}</p></div>{row.original.isFeatured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}</div>) },
  { accessorKey: "category", header: "Category", cell: ({ getValue }) => { const c = getValue() as string | null; return c ? <Badge variant="secondary">{c}</Badge> : <span className="text-muted-foreground">—</span> } },
  { accessorKey: "status", header: "Status", cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant="secondary" className={statusColors[s] || ""}>{s.replace(/_/g, " ")}</Badge> } },
  { accessorKey: "startDate", header: "Date", cell: ({ getValue }) => <span className="text-sm">{new Date(getValue() as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span> },
  { id: "registrations", header: "Registrations", cell: ({ row }) => <span className="text-sm">{row.original.currentRegistrations}{row.original.maxCapacity ? ` / ${row.original.maxCapacity}` : ""}</span> },
  { id: "type", header: "Type", cell: ({ row }) => <Badge variant="outline">{row.original.isPaid ? "Paid" : "Free"}</Badge> },
]

export default function SuperAdminEventsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<EventRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/super-admin/events?${params}`)
      const json = await res.json()
      if (json.success) { setData(json.data); setTotal(json.pagination.total) }
    } catch { toast.error("Failed to load") } finally { setIsLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  return (
    <div className="space-y-6">
      <PageHeader title="All Events" description="Events across the entire platform" breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Events" }]} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Events" value={String(total)} icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Active" value={String(data.filter(e => ["PUBLISHED","REGISTRATION_OPEN","ONGOING"].includes(e.status)).length)} icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Completed" value={String(data.filter(e => e.status === "COMPLETED").length)} icon={Calendar} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
      </div>
      <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DataTable columns={columns} data={data} isLoading={isLoading} pagination={{ page, pageSize: 20, total }} onPaginationChange={(p) => setPage(p)}
        emptyState={<div className="text-center py-4"><Calendar className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No events yet</p></div>}
      />
    </div>
  )
}

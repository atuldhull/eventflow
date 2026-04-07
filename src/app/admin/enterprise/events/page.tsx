"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Calendar, Plus, MoreHorizontal, Star } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"

interface EventRow { id: string; title: string; organization: string; category: string | null; status: string; startDate: string; currentRegistrations: number; maxCapacity: number | null; isPaid: boolean; isFeatured: boolean }

const statusColors: Record<string, string> = { DRAFT: "bg-zinc-100 text-zinc-700", PUBLISHED: "bg-blue-100 text-blue-700", ONGOING: "bg-emerald-100 text-emerald-700", COMPLETED: "bg-purple-100 text-purple-700", CANCELLED: "bg-red-100 text-red-700" }

const columns: ColumnDef<EventRow, unknown>[] = [
  { accessorKey: "title", header: "Event", cell: ({ row }) => (<div className="flex items-center gap-2"><div><p className="font-medium">{row.original.title}</p><p className="text-xs text-muted-foreground">{row.original.organization}</p></div>{row.original.isFeatured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}</div>) },
  { accessorKey: "category", header: "Category", cell: ({ getValue }) => { const cat = getValue() as string | null; return cat ? <Badge variant="secondary">{cat}</Badge> : <span className="text-muted-foreground">—</span> } },
  { accessorKey: "status", header: "Status", cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant="secondary" className={statusColors[s] || ""}>{s.replace(/_/g, " ")}</Badge> } },
  { accessorKey: "startDate", header: "Date", cell: ({ getValue }) => <span className="text-sm">{new Date(getValue() as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span> },
  { id: "registrations", header: "Registrations", cell: ({ row }) => <span className="text-sm">{row.original.currentRegistrations}{row.original.maxCapacity ? ` / ${row.original.maxCapacity}` : ""}</span> },
]

export default function EnterpriseEventsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const { accessibleEnterprises, currentEnterpriseId } = useRBAC()
  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)

  const [events, setEvents] = useState<EventRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, published: 0, ongoing: 0, completed: 0 })

  const fetchEvents = useCallback(async () => {
    if (!currentEnterpriseId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/events?${params}`)
      const json = await res.json()
      if (json.success) {
        setEvents(json.data)
        setTotal(json.pagination.total)
        const all = json.data as EventRow[]
        setStats({ total: json.pagination.total, published: all.filter(e => ["PUBLISHED","REGISTRATION_OPEN"].includes(e.status)).length, ongoing: all.filter(e => e.status === "ONGOING").length, completed: all.filter(e => e.status === "COMPLETED").length })
      }
    } catch { toast.error("Failed to load events") } finally { setIsLoading(false) }
  }, [currentEnterpriseId, page, debouncedSearch])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  return (
    <div className="space-y-6">
      <PageHeader title="Events" description={`All events across ${enterprise?.name || "your enterprise"}`} breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Enterprise", href: "/admin/enterprise" }, { label: "Events" }]} />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total" value={String(stats.total)} icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Published" value={String(stats.published)} icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Ongoing" value={String(stats.ongoing)} icon={Calendar} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard title="Completed" value={String(stats.completed)} icon={Calendar} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
      </div>
      <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DataTable columns={columns} data={events} isLoading={isLoading} pagination={{ page, pageSize: 10, total }} onPaginationChange={(p) => setPage(p)}
        emptyState={<div className="text-center py-4"><Calendar className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No events yet</p></div>}
      />
    </div>
  )
}

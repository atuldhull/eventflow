"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { ScrollText } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/useDebounce"

interface AuditRow { id: string; userName: string; action: string; entityType: string; description: string | null; ipAddress: string | null; createdAt: string }
const actionColors: Record<string, string> = { CREATE: "bg-green-100 text-green-700", UPDATE: "bg-blue-100 text-blue-700", DELETE: "bg-red-100 text-red-700", APPROVE: "bg-emerald-100 text-emerald-700", REJECT: "bg-orange-100 text-orange-700", PUBLISH: "bg-purple-100 text-purple-700", LOGIN: "bg-zinc-100 text-zinc-700" }

const columns: ColumnDef<AuditRow, unknown>[] = [
  { accessorKey: "createdAt", header: "Time", cell: ({ getValue }) => <span className="text-xs">{new Date(getValue() as string).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> },
  { accessorKey: "userName", header: "User", cell: ({ row }) => (<div className="flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">{row.original.userName?.[0] || "?"}</div><span className="text-sm">{row.original.userName}</span></div>) },
  { accessorKey: "action", header: "Action", cell: ({ getValue }) => { const a = getValue() as string; return <Badge variant="secondary" className={actionColors[a] || ""}>{a}</Badge> } },
  { accessorKey: "entityType", header: "Entity", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "description", header: "Description", cell: ({ getValue }) => <span className="text-sm text-muted-foreground truncate max-w-xs block">{(getValue() as string) || "—"}</span> },
  { accessorKey: "ipAddress", header: "IP", cell: ({ getValue }) => <span className="text-xs text-muted-foreground font-mono">{(getValue() as string) || "—"}</span> },
]

export default function SuperAdminAuditPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/super-admin/audit-logs?${params}`)
      const json = await res.json()
      if (json.success) { setData(json.data); setTotal(json.pagination.total) }
    } catch { toast.error("Failed to load") } finally { setIsLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Audit Logs" description="All actions across the entire platform" breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Audit Logs" }]} />
      <Input placeholder="Search by description..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DataTable columns={columns} data={data} isLoading={isLoading} pagination={{ page, pageSize: 50, total }} onPaginationChange={(p) => setPage(p)}
        emptyState={<div className="text-center py-4"><ScrollText className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No audit logs yet</p></div>}
      />
    </div>
  )
}

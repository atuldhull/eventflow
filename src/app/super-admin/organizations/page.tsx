"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Building2, CheckCircle } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/useDebounce"

interface OrgRow { id: string; name: string; slug: string; category: string | null; email: string; isActive: boolean; isVerified: boolean; enterprise: string; _count: { events: number; members: number }; createdAt: string }

const columns: ColumnDef<OrgRow, unknown>[] = [
  { accessorKey: "name", header: "Organization", cell: ({ row }) => (<div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Building2 className="h-4 w-4 text-primary" /></div><div><p className="font-medium">{row.original.name}</p><p className="text-xs text-muted-foreground">{row.original.slug}</p></div>{row.original.isVerified && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}</div>) },
  { accessorKey: "enterprise", header: "Enterprise", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "category", header: "Category", cell: ({ getValue }) => { const c = getValue() as string | null; return c ? <Badge variant="secondary">{c}</Badge> : <span className="text-muted-foreground">—</span> } },
  { id: "events", header: "Events", cell: ({ row }) => <span className="text-sm">{row.original._count?.events ?? 0}</span> },
  { id: "members", header: "Members", cell: ({ row }) => <span className="text-sm">{row.original._count?.members ?? 0}</span> },
  { accessorKey: "isActive", header: "Status", cell: ({ row }) => <Badge variant={row.original.isActive ? "default" : "secondary"}>{row.original.isActive ? "Active" : "Inactive"}</Badge> },
]

export default function SuperAdminOrganizationsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<OrgRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchOrgs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/super-admin/organizations?${params}`)
      const json = await res.json()
      if (json.success) { setData(json.data); setTotal(json.pagination.total) }
    } catch { toast.error("Failed to load") } finally { setIsLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { fetchOrgs() }, [fetchOrgs])

  return (
    <div className="space-y-6">
      <PageHeader title="All Organizations" description="Organizations across the entire platform" breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Organizations" }]} />
      <Input placeholder="Search organizations..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DataTable columns={columns} data={data} isLoading={isLoading} pagination={{ page, pageSize: 20, total }} onPaginationChange={(p) => setPage(p)}
        emptyState={<div className="text-center py-4"><Building2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No organizations yet</p></div>}
      />
    </div>
  )
}

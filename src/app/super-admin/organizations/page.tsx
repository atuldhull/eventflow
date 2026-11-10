"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { BadgeCheck } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Pill } from "@/components/ui/pill"
import { useDebounce } from "@/hooks/useDebounce"
import { statusLabel } from "@/lib/status-tone"
import { SearchField, TableEmpty, Initial, num } from "@/app/admin/enterprise/_components/admin-ui"

interface OrgRow { id: string; name: string; slug: string; category: string | null; email: string; isActive: boolean; isVerified: boolean; enterprise: string; _count: { events: number; members: number }; createdAt: string }

const columns: ColumnDef<OrgRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Organization",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <Initial name={row.original.name} className="rounded-md" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{row.original.name}</span>
            {row.original.isVerified && <BadgeCheck className="size-4 shrink-0 text-brand" aria-label="Verified" />}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      </div>
    ),
    meta: { className: "min-w-[220px]" },
  },
  { accessorKey: "enterprise", header: "Enterprise", cell: ({ getValue }) => <span>{(getValue() as string) || "—"}</span> },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ getValue }) => { const c = getValue() as string | null; return c ? <span className="text-muted-foreground">{statusLabel(c)}</span> : <span className="text-faint">—</span> },
  },
  { id: "events", header: "Events", cell: ({ row }) => num(row.original._count?.events), meta: { align: "right" } },
  { id: "members", header: "Members", cell: ({ row }) => num(row.original._count?.members), meta: { align: "right" } },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => <Pill tone={row.original.isActive ? "positive" : "neutral"}>{row.original.isActive ? "Active" : "Inactive"}</Pill>,
  },
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
      <PageHeader
        title="Organizations"
        description={isLoading && total === 0 ? "Organizations across the entire platform" : `${num(total)} organization${total === 1 ? "" : "s"} across the platform`}
      />
      <SearchField value={search} onChange={setSearch} placeholder="Search organizations…" />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize: 20, total }}
        onPaginationChange={(p) => setPage(p)}
        emptyState={<TableEmpty title={debouncedSearch ? "No matching organizations" : "No organizations yet"} description={debouncedSearch ? "Try a different search." : undefined} />}
      />
    </div>
  )
}

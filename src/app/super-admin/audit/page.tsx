"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Pill } from "@/components/ui/pill"
import { useDebounce } from "@/hooks/useDebounce"
import { statusLabel } from "@/lib/status-tone"
import { SearchField, TableEmpty, Initial, fmtDateTime, num } from "@/app/admin/enterprise/_components/admin-ui"

interface AuditRow { id: string; userName: string; action: string; entityType: string; description: string | null; ipAddress: string | null; createdAt: string }

const columns: ColumnDef<AuditRow, unknown>[] = [
  {
    accessorKey: "createdAt",
    header: "Time",
    cell: ({ getValue }) => <span className="text-[13px] text-muted-foreground tabular-nums">{fmtDateTime(getValue() as string)}</span>,
  },
  {
    accessorKey: "userName",
    header: "User",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <Initial name={row.original.userName} className="size-6 text-[11px]" />
        <span className="font-medium">{row.original.userName}</span>
      </div>
    ),
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ getValue }) => <Pill>{statusLabel(getValue() as string)}</Pill>,
  },
  {
    accessorKey: "entityType",
    header: "Entity",
    cell: ({ getValue }) => <span className="text-muted-foreground">{statusLabel(getValue() as string)}</span>,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ getValue }) => (
      <span className="block max-w-xs truncate text-muted-foreground" title={(getValue() as string) || undefined}>
        {(getValue() as string) || "—"}
      </span>
    ),
  },
  {
    accessorKey: "ipAddress",
    header: "IP",
    cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{(getValue() as string) || "—"}</span>,
  },
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
      <PageHeader
        title="Audit log"
        description={isLoading && total === 0 ? "All actions across the platform" : `${num(total)} action${total === 1 ? "" : "s"} across the platform`}
      />
      <SearchField value={search} onChange={setSearch} placeholder="Search by description…" />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize: 50, total }}
        onPaginationChange={(p) => setPage(p)}
        emptyState={<TableEmpty title={debouncedSearch ? "No matching actions" : "No audit logs yet"} description={debouncedSearch ? "Try a different search." : undefined} />}
      />
    </div>
  )
}

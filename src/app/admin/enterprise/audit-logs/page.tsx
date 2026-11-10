"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Pill } from "@/components/ui/pill"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { statusLabel } from "@/lib/status-tone"
import { SearchField, TableEmpty, Initial, fmtDateTime, num } from "../_components/admin-ui"
import { ExportButton } from "../_components/export-button"

interface AuditRow { id: string; userName: string; action: string; entityType: string; description: string | null; createdAt: string }

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
      <span className="block max-w-[420px] truncate text-muted-foreground" title={(getValue() as string) || undefined}>
        {(getValue() as string) || "—"}
      </span>
    ),
  },
]

export default function EnterpriseAuditLogsPage() {
  const { currentEnterpriseId } = useRBAC()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    if (!currentEnterpriseId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/audit-logs?${params}`)
      const json = await res.json()
      if (json.success) { setData(json.data); setTotal(json.pagination.total) }
    } catch { toast.error("Failed to load") } finally { setIsLoading(false) }
  }, [currentEnterpriseId, page, debouncedSearch])

  const exportUrl = currentEnterpriseId
    ? `/api/admin/enterprise/${currentEnterpriseId}/audit-logs/export${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`
    : ""

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description={isLoading && total === 0 ? "Activity across your enterprise" : `${num(total)} recorded action${total === 1 ? "" : "s"}${debouncedSearch ? " matching your search" : " across your enterprise"}`}
        actions={
          exportUrl ? (
            <PermissionGate permission={PERMISSIONS.AUDIT_EXPORT}>
              <ExportButton url={exportUrl} fallbackName="audit-log.csv" />
            </PermissionGate>
          ) : null
        }
      />
      <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search by user, entity or description…" className="sm:max-w-sm" />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize: 50, total }}
        onPaginationChange={(p) => setPage(p)}
        emptyState={
          debouncedSearch
            ? <TableEmpty title="No matching actions" description="Try a different search." />
            : <TableEmpty title="No audit logs yet" description="Changes made by your team will be recorded here." />
        }
      />
    </div>
  )
}

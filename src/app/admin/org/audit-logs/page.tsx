"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { ScrollText } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTable } from "@/components/tables/DataTable"
import { DataTableSearch, DataTableToolbar } from "@/components/tables/DataTableToolbar"
import { Pill, type Tone } from "@/components/ui/pill"
import { statusLabel } from "@/lib/status-tone"
import { useDebounce } from "@/hooks/useDebounce"
import { useRBAC } from "@/hooks/useRBAC"

interface AuditRow { id: string; userName: string; action: string; entityType: string; description: string | null; createdAt: string }

const actionTone: Record<string, Tone> = {
  CREATE: "positive",
  UPDATE: "info",
  DELETE: "negative",
  APPROVE: "positive",
  PUBLISH: "brand",
}

const columns: ColumnDef<AuditRow, unknown>[] = [
  {
    accessorKey: "createdAt",
    header: "Time",
    cell: ({ getValue }) => (
      <span className="text-[13px] text-muted-foreground">
        {new Date(getValue() as string).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </span>
    ),
  },
  {
    accessorKey: "userName",
    header: "User",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {row.original.userName?.[0]?.toUpperCase() || "?"}
        </span>
        <span>{row.original.userName}</span>
      </div>
    ),
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ getValue }) => {
      const a = getValue() as string
      return <Pill tone={actionTone[a] ?? "neutral"}>{statusLabel(a)}</Pill>
    },
  },
  { accessorKey: "entityType", header: "Entity", cell: ({ getValue }) => <span>{getValue() as string}</span> },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ getValue }) => (
      <span className="block max-w-[420px] truncate text-muted-foreground">{(getValue() as string) || "—"}</span>
    ),
  },
]

export default function OrgAuditLogsPage() {
  const { currentOrganizationId } = useRBAC()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search.trim())
  const [page, setPage] = useState(1)
  // a new search starts again from the first page
  const [searchedFor, setSearchedFor] = useState(debouncedSearch)
  if (searchedFor !== debouncedSearch) {
    setSearchedFor(debouncedSearch)
    setPage(1)
  }
  const [data, setData] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    if (!currentOrganizationId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/audit-logs?${params}`)
      const json = await res.json()
      if (json.success) { setData(json.data); setTotal(json.pagination.total) }
    } catch { toast.error("Failed to load audit logs") }
    finally { setIsLoading(false) }
  }, [currentOrganizationId, page, debouncedSearch])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Activity log for your organization" />
      <div className="space-y-3">
        <DataTableToolbar>
          <DataTableSearch placeholder="Search by person, entity or description" value={search} onChange={(e) => setSearch(e.target.value)} />
        </DataTableToolbar>
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          pagination={{ page, pageSize: 50, total }}
          onPaginationChange={(p) => setPage(p)}
          emptyState={
            <EmptyState
              icon={ScrollText}
              title={debouncedSearch ? "No matching activity" : "No audit logs yet"}
              description={debouncedSearch ? "Try another name, action or word." : "Actions will be logged here automatically."}
              className="border-0 py-6"
            />
          }
        />
      </div>
    </div>
  )
}

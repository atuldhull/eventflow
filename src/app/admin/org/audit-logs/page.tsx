"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { ScrollText } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/useDebounce"

interface AuditRow { id: string; userName: string; action: string; entityType: string; description: string | null; createdAt: string }

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  APPROVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PUBLISH: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
}

const columns: ColumnDef<AuditRow, unknown>[] = [
  { accessorKey: "createdAt", header: "Timestamp", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "userName", header: "User", cell: ({ row }) => (<div className="flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">{row.original.userName?.[0] || "?"}</div><span className="text-sm">{row.original.userName}</span></div>) },
  { accessorKey: "action", header: "Action", cell: ({ getValue }) => { const a = getValue() as string; return <Badge variant="secondary" className={actionColors[a] || ""}>{a}</Badge> } },
  { accessorKey: "entityType", header: "Entity", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "description", header: "Description", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{(getValue() as string) || "—"}</span> },
]

export default function OrgAuditLogsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Activity log for your organization" breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" }, { label: "Audit Logs" }]} />
      <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DataTable columns={columns} data={[]} isLoading={false} pagination={{ page, pageSize: 50, total: 0 }} onPaginationChange={(p) => setPage(p)}
        emptyState={<div className="text-center py-4"><ScrollText className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No audit logs yet</p></div>}
      />
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Building2, Plus, MoreHorizontal, BadgeCheck, LayoutGrid, List } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTable } from "@/components/tables/DataTable"
import { DataTablePagination } from "@/components/tables/DataTablePagination"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"
import { usePermissions } from "@/hooks/usePermissions"
import { statusLabel } from "@/lib/status-tone"
import { cn } from "@/lib/utils"
import { SearchField, TableEmpty, Initial, num } from "../_components/admin-ui"
import { TypedConfirmDialog } from "../_components/typed-confirm-dialog"

interface OrgRow {
  id: string
  name: string
  slug: string
  category: string | null
  isActive: boolean
  isVerified: boolean
  _count: { events: number; members: number }
}

const PAGE_SIZE = 12

function OrgName({ org }: { org: OrgRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Initial name={org.name} className="rounded-md" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{org.name}</span>
          {org.isVerified && <BadgeCheck className="size-4 shrink-0 text-brand" aria-label="Verified" />}
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground">{org.slug}</p>
      </div>
    </div>
  )
}

interface RowActions {
  canEdit: boolean
  canDelete: boolean
  onToggleActive: (org: OrgRow) => void
  onDelete: (org: OrgRow) => void
}

const buildColumns = ({ canEdit, canDelete, onToggleActive, onDelete }: RowActions): ColumnDef<OrgRow, unknown>[] => [
  {
    accessorKey: "name",
    header: "Organization",
    cell: ({ row }) => <OrgName org={row.original} />,
    meta: { className: "min-w-[220px]" },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ getValue }) => {
      const cat = getValue() as string | null
      return cat ? <span className="text-muted-foreground">{statusLabel(cat)}</span> : <span className="text-faint">—</span>
    },
  },
  { id: "events", header: "Events", cell: ({ row }) => num(row.original._count?.events), meta: { align: "right" } },
  { id: "members", header: "Members", cell: ({ row }) => num(row.original._count?.members), meta: { align: "right" } },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => <Pill tone={row.original.isActive ? "positive" : "neutral"}>{row.original.isActive ? "Active" : "Inactive"}</Pill>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.name}`} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/admin/enterprise/organizations/${row.original.id}`} />}>View dashboard</DropdownMenuItem>
          {canEdit && <DropdownMenuItem render={<Link href={`/admin/enterprise/organizations/${row.original.id}/edit`} />}>Edit</DropdownMenuItem>}
          {(canEdit || canDelete) && <DropdownMenuSeparator />}
          {canEdit && (
            <DropdownMenuItem onClick={() => onToggleActive(row.original)}>{row.original.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
          )}
          {canDelete && <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.original)}>Delete</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    meta: { align: "right", className: "w-12", stickyRight: true },
  },
]

export default function OrganizationsPage() {
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"table" | "card">("card")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const { currentEnterpriseId, accessibleEnterprises } = useRBAC()
  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)
  const [data, setData] = useState<OrgRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<OrgRow | null>(null)
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission(PERMISSIONS.ORG_EDIT)
  const canDelete = hasPermission(PERMISSIONS.ORG_DELETE)

  const fetchOrgs = useCallback(async () => {
    if (!currentEnterpriseId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/organizations?${params}`)
      const json = await res.json()
      if (json.success) { setData(json.data); setTotal(json.pagination?.total ?? json.data.length) }
    } catch { toast.error("Failed to load organizations") } finally { setIsLoading(false) }
  }, [currentEnterpriseId, page, debouncedSearch])

  useEffect(() => { fetchOrgs() }, [fetchOrgs])

  const toggleActive = useCallback(async (org: OrgRow) => {
    if (!currentEnterpriseId) return
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !org.isActive }),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) { toast.error(json?.message || "Failed to update organization"); return }
      toast.success(`${org.name} ${org.isActive ? "deactivated" : "activated"}`)
      fetchOrgs()
    } catch {
      toast.error("Failed to update organization")
    }
  }, [currentEnterpriseId, fetchOrgs])

  const deleteOrg = async () => {
    if (!currentEnterpriseId || !deleteTarget) return
    const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/organizations/${deleteTarget.id}`, { method: "DELETE" })
    const json = await res.json().catch(() => null)
    if (!json?.success) {
      toast.error(json?.message || "Failed to delete organization")
      throw new Error("delete failed")
    }
    toast.success(`${deleteTarget.name} deleted`)
    fetchOrgs()
  }

  const columns = useMemo(
    () => buildColumns({ canEdit, canDelete, onToggleActive: toggleActive, onDelete: setDeleteTarget }),
    [canEdit, canDelete, toggleActive]
  )

  const createLink = (
    <PermissionGate permission={PERMISSIONS.ORG_CREATE}>
      <Link href="/admin/enterprise/organizations/create" className={buttonVariants()}>
        <Plus />
        Create organization
      </Link>
    </PermissionGate>
  )

  const empty = debouncedSearch
    ? { title: "No matching organizations", description: "Try a different search." }
    : { title: "No organizations yet", description: "Create your first organization to start managing events." }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description={`Organizations in ${enterprise?.name || "your enterprise"}`}
        actions={createLink}
      />

      <div className="flex items-center gap-3">
        <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search organizations…" className="flex-1 sm:flex-none" />
        <div role="group" aria-label="Layout" className="ml-auto inline-flex shrink-0 rounded-md border bg-raised p-0.5">
          {([
            { id: "card", label: "Grid view", icon: LayoutGrid },
            { id: "table", label: "Table view", icon: List },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn(
                "flex size-8 items-center justify-center rounded-[5px] transition-colors pointer-coarse:size-10",
                view === id ? "bg-background text-foreground shadow-[0_0_0_1px_var(--border)]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          pagination={{ page, pageSize: PAGE_SIZE, total }}
          onPaginationChange={(p) => setPage(p)}
          emptyState={<TableEmpty {...empty} />}
        />
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading organizations">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="gap-0 p-4">
              <div className="flex items-center gap-3"><Skeleton className="size-8 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>
              <Skeleton className="mt-5 h-3.5 w-1/2" />
            </Card>
          ))}
        </div>
      ) : data.length > 0 ? (
        <div className="space-y-3">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/admin/enterprise/organizations/${org.id}`}
                  className="flex h-full flex-col gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
                >
                  <OrgName org={org} />
                  <div className="mt-auto flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
                    <span className="truncate tabular-nums">
                      {org.category ? `${statusLabel(org.category)} · ` : ""}
                      {num(org._count?.events)} event{org._count?.events === 1 ? "" : "s"} · {num(org._count?.members)} member{org._count?.members === 1 ? "" : "s"}
                    </span>
                    <Pill tone={org.isActive ? "positive" : "neutral"} className="shrink-0">{org.isActive ? "Active" : "Inactive"}</Pill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {total > PAGE_SIZE && (
            <DataTablePagination page={page} pageSize={PAGE_SIZE} total={total} onPaginationChange={(p) => setPage(p)} />
          )}
        </div>
      ) : (
        <EmptyState variant="page" icon={Building2} title={empty.title} description={empty.description}>
          {!debouncedSearch && createLink}
        </EmptyState>
      )}

      <TypedConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={`Delete ${deleteTarget?.name ?? "organization"}?`}
        description="The organization is removed from your enterprise and switched off. Its events and history are kept, and the deletion is recorded in the audit log."
        confirmText={deleteTarget?.name ?? ""}
        actionLabel="Delete organization"
        onConfirm={deleteOrg}
      />
    </div>
  )
}

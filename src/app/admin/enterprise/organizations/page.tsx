"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Building2, Plus, MoreHorizontal, CheckCircle, LayoutGrid, List } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface OrgRow {
  id: string
  name: string
  slug: string
  category: string | null
  isActive: boolean
  isVerified: boolean
  _count: { events: number; members: number }
}

const columns: ColumnDef<OrgRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Organization",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-sm font-medium text-blue-500">
          {row.original.name[0]}
        </div>
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ getValue }) => {
      const cat = getValue() as string | null
      return cat ? <Badge variant="secondary">{cat}</Badge> : <span className="text-muted-foreground">—</span>
    },
  },
  {
    id: "events",
    header: "Events",
    cell: ({ row }) => row.original._count?.events ?? 0,
  },
  {
    id: "members",
    header: "Members",
    cell: ({ row }) => row.original._count?.members ?? 0,
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
        {row.original.isVerified && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
      </div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View Dashboard</DropdownMenuItem>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{row.original.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function OrganizationsPage() {
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"table" | "card">("card")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const { currentEnterpriseId, accessibleEnterprises } = useRBAC()
  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description={`Manage organizations in ${enterprise?.name || "your enterprise"}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Enterprise", href: "/admin/enterprise" },
          { label: "Organizations" },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.ORG_CREATE}>
            <Link href="/admin/enterprise/organizations/create" className={cn(buttonVariants(), "gap-2")}>
              <Plus className="h-4 w-4" />
              Create Organization
            </Link>
          </PermissionGate>
        }
      />

      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-1">
          <Button variant={view === "card" ? "default" : "ghost"} size="icon-sm" onClick={() => setView("card")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={view === "table" ? "default" : "ghost"} size="icon-sm" onClick={() => setView("table")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          columns={columns}
          data={[]}
          isLoading={false}
          pagination={{ page, pageSize: 10, total: 0 }}
          onPaginationChange={(p) => setPage(p)}
          emptyState={
            <div className="text-center py-4">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="font-medium">No organizations yet</p>
              <p className="text-sm text-muted-foreground">Create your first organization to start managing events.</p>
            </div>
          }
        />
      ) : (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium">No organizations yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first organization to start managing events.</p>
          <PermissionGate permission={PERMISSIONS.ORG_CREATE}>
            <Link href="/admin/enterprise/organizations/create" className={cn(buttonVariants(), "mt-4 gap-2")}>
              <Plus className="h-4 w-4" />
              Create Organization
            </Link>
          </PermissionGate>
        </div>
      )}
    </div>
  )
}

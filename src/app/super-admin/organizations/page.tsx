"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Building2, Plus, MoreHorizontal, CheckCircle } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useDebounce } from "@/hooks/useDebounce"

interface OrgRow {
  id: string
  name: string
  slug: string
  category: string | null
  enterpriseName: string | null
  isActive: boolean
  isVerified: boolean
  _count: { events: number; members: number }
}

const columns: ColumnDef<OrgRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Organization",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.slug}</p>
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
    accessorKey: "enterpriseName",
    header: "Enterprise",
    cell: ({ getValue }) => {
      const name = getValue() as string | null
      return name ? <span className="text-sm">{name}</span> : <Badge variant="outline">Standalone</Badge>
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
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{row.original.isVerified ? "Unverify" : "Verify"}</DropdownMenuItem>
          <DropdownMenuItem>{row.original.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function OrganizationsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage all organizations on the platform"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Organizations" },
        ]}
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Organization
          </Button>
        }
      />

      <Input
        placeholder="Search organizations..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <DataTable
        columns={columns}
        data={[]}
        isLoading={false}
        pagination={{ page, pageSize, total: 0 }}
        onPaginationChange={(p, ps) => { setPage(p); setPageSize(ps) }}
        emptyState={
          <div className="text-center py-4">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="font-medium">No organizations yet</p>
            <p className="text-sm text-muted-foreground">Organizations will appear here.</p>
          </div>
        }
      />
    </div>
  )
}

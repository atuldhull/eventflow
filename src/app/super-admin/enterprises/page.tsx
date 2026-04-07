"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Building2, Plus, MoreHorizontal, CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"

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

interface Enterprise {
  id: string
  name: string
  slug: string
  type: string | null
  email: string
  isActive: boolean
  isVerified: boolean
  createdAt: string
  _count: { organizations: number; events: number; members: number }
  owner: { name: string }
}

const columns: ColumnDef<Enterprise, unknown>[] = [
  {
    accessorKey: "name",
    header: "Enterprise",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ getValue }) => {
      const type = getValue() as string | null
      return type ? <Badge variant="secondary">{type}</Badge> : <span className="text-muted-foreground">—</span>
    },
  },
  {
    accessorKey: "owner",
    header: "Owner",
    cell: ({ row }) => <span className="text-sm">{row.original.owner?.name || "—"}</span>,
  },
  {
    id: "orgs",
    header: "Orgs",
    cell: ({ row }) => row.original._count?.organizations ?? 0,
  },
  {
    id: "events",
    header: "Events",
    cell: ({ row }) => row.original._count?.events ?? 0,
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
        {row.original.isVerified && (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        )}
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

export default function EnterprisesPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Data would come from API in production
  const data: Enterprise[] = []
  const total = 0
  const isLoading = false

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprises"
        description="Manage all enterprises on the platform"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Enterprises" },
        ]}
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Enterprise
          </Button>
        }
      />

      <div className="flex gap-4">
        <Input
          placeholder="Search enterprises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        pagination={{ page, pageSize, total }}
        onPaginationChange={(p, ps) => { setPage(p); setPageSize(ps) }}
        emptyState={
          <div className="text-center py-4">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="font-medium">No enterprises yet</p>
            <p className="text-sm text-muted-foreground">Create your first enterprise to get started.</p>
          </div>
        }
      />
    </div>
  )
}

"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Calendar, Plus, MoreHorizontal, Star } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
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
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"

interface EventRow {
  id: string
  title: string
  organization: string
  category: string | null
  status: string
  startDate: string
  currentRegistrations: number
  maxCapacity: number | null
  isPaid: boolean
  isFeatured: boolean
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PUBLISHED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ONGOING: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  COMPLETED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

const columns: ColumnDef<EventRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">{row.original.organization}</p>
        </div>
        {row.original.isFeatured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
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
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue() as string
      return <Badge variant="secondary" className={statusColors[status] || ""}>{status.replace(/_/g, " ")}</Badge>
    },
  },
  {
    accessorKey: "startDate",
    header: "Date",
    cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span>,
  },
  {
    id: "registrations",
    header: "Registrations",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.currentRegistrations}{row.original.maxCapacity ? ` / ${row.original.maxCapacity}` : ""}
      </span>
    ),
  },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuItem>Edit Event</DropdownMenuItem>
          <DropdownMenuItem>View Registrations</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Cancel Event</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function EnterpriseEventsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const { accessibleEnterprises, currentEnterpriseId } = useRBAC()
  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description={`All events across ${enterprise?.name || "your enterprise"}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Enterprise", href: "/admin/enterprise" },
          { label: "Events" },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          </PermissionGate>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total" value="0" icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Published" value="0" icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Ongoing" value="0" icon={Calendar} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard title="Completed" value="0" icon={Calendar} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
      </div>

      <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <DataTable
        columns={columns}
        data={[]}
        isLoading={false}
        pagination={{ page, pageSize: 10, total: 0 }}
        onPaginationChange={(p) => setPage(p)}
        emptyState={
          <div className="text-center py-4">
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="font-medium">No events yet</p>
            <p className="text-sm text-muted-foreground">Create your first event to get started.</p>
          </div>
        }
      />
    </div>
  )
}

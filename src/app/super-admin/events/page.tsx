"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Calendar, MoreHorizontal, Star } from "lucide-react"

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
import { useDebounce } from "@/hooks/useDebounce"

interface EventRow {
  id: string
  title: string
  slug: string
  category: string | null
  status: string
  type: string
  startDate: string
  endDate: string
  currentRegistrations: number
  maxCapacity: number | null
  isPaid: boolean
  isFeatured: boolean
  organization: { name: string } | null
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PUBLISHED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  REGISTRATION_OPEN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ONGOING: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  COMPLETED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  POSTPONED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

const columns: ColumnDef<EventRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">{row.original.organization?.name || "Direct"}</p>
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
      return (
        <Badge variant="secondary" className={statusColors[status] || ""}>
          {status.replace(/_/g, " ")}
        </Badge>
      )
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ getValue }) => <Badge variant="outline">{(getValue() as string).replace(/_/g, " ")}</Badge>,
  },
  {
    id: "registrations",
    header: "Registrations",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.currentRegistrations}
        {row.original.maxCapacity ? ` / ${row.original.maxCapacity}` : ""}
      </span>
    ),
  },
  {
    id: "revenue",
    header: "Revenue",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.isPaid ? "Paid" : "Free"}</span>
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
          <DropdownMenuItem>View Event</DropdownMenuItem>
          <DropdownMenuItem>{row.original.isFeatured ? "Unfeature" : "Feature"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Cancel Event</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function EventsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="View and manage all events across the platform"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Events" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total Events" value="0" icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Published" value="0" icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Ongoing" value="0" icon={Calendar} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard title="Completed" value="0" icon={Calendar} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
      </div>

      <Input
        placeholder="Search events..."
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
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="font-medium">No events yet</p>
            <p className="text-sm text-muted-foreground">Events will appear here once they are created.</p>
          </div>
        }
      />
    </div>
  )
}

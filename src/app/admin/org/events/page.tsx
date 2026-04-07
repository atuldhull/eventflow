"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Calendar, Plus, MoreHorizontal, Star, LayoutGrid, List } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"

interface EventRow {
  id: string
  title: string
  category: string | null
  status: string
  type: string
  startDate: string
  currentRegistrations: number
  maxCapacity: number | null
  isPaid: boolean
  isFeatured: boolean
  visibility: string
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PUBLISHED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  REGISTRATION_OPEN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
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
          <p className="text-xs text-muted-foreground">{row.original.startDate}</p>
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
    id: "registrations",
    header: "Registrations",
    cell: ({ row }) => {
      const { currentRegistrations, maxCapacity } = row.original
      const pct = maxCapacity ? (currentRegistrations / maxCapacity) * 100 : 0
      return (
        <div className="space-y-1">
          <span className="text-sm">{currentRegistrations}{maxCapacity ? ` / ${maxCapacity}` : ""}</span>
          {maxCapacity && (
            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full", pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500")} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          )}
        </div>
      )
    },
  },
  {
    id: "revenue",
    header: "Revenue",
    cell: ({ row }) => <span className="text-sm">{row.original.isPaid ? "Paid" : "Free"}</span>,
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
          <DropdownMenuItem>Registrations</DropdownMenuItem>
          <DropdownMenuItem>Check-in</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Cancel Event</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function OrgEventsPage() {
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"table" | "card">("table")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const { accessibleOrganizations, currentOrganizationId } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description={`Manage events for ${org?.name || "your organization"}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Organization", href: "/admin/org" },
          { label: "Events" },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
            <Link href="/admin/org/events/create" className={cn(buttonVariants(), "gap-2")}>
              <Plus className="h-4 w-4" /> Create Event
            </Link>
          </PermissionGate>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total" value="0" icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Published" value="0" icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Ongoing" value="0" icon={Calendar} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard title="Completed" value="0" icon={Calendar} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <div className="flex gap-1">
          <Button variant={view === "table" ? "default" : "ghost"} size="icon-sm" onClick={() => setView("table")}>
            <List className="h-4 w-4" />
          </Button>
          <Button variant={view === "card" ? "default" : "ghost"} size="icon-sm" onClick={() => setView("card")}>
            <LayoutGrid className="h-4 w-4" />
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
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="font-medium">No events yet</p>
              <p className="text-sm text-muted-foreground">Create your first event to get started.</p>
              <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
                <Link href="/admin/org/events/create" className={cn(buttonVariants(), "mt-3 gap-2")}>
                  <Plus className="h-4 w-4" /> Create Event
                </Link>
              </PermissionGate>
            </div>
          }
        />
      ) : (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium">No events yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first event to get started.</p>
        </div>
      )}
    </div>
  )
}

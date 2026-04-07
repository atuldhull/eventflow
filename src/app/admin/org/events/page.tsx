"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Calendar, Plus, MoreHorizontal, Star, LayoutGrid, List } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

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
  slug: string
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

const staticColumns: ColumnDef<EventRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div>
          <Link href={`/admin/org/events/${row.original.id}`} className="font-medium hover:underline">{row.original.title}</Link>
          <p className="text-xs text-muted-foreground">{new Date(row.original.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
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
]

export default function OrgEventsPage() {
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"table" | "card">("table")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const { accessibleOrganizations, currentOrganizationId } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)

  const [events, setEvents] = useState<EventRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, published: 0, ongoing: 0, completed: 0 })

  const fetchEvents = useCallback(async () => {
    if (!currentOrganizationId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/events?${params}`)
      const json = await res.json()
      if (json.success) {
        setEvents(json.data)
        setTotal(json.pagination.total)
        // Compute stats from all data
        const all = json.data as EventRow[]
        setStats({
          total: json.pagination.total,
          published: all.filter((e) => e.status === "PUBLISHED" || e.status === "REGISTRATION_OPEN").length,
          ongoing: all.filter((e) => e.status === "ONGOING").length,
          completed: all.filter((e) => e.status === "COMPLETED").length,
        })
      }
    } catch {
      toast.error("Failed to load events")
    } finally {
      setIsLoading(false)
    }
  }, [currentOrganizationId, page, pageSize, debouncedSearch])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const columns = useMemo<ColumnDef<EventRow, unknown>[]>(() => [
    ...staticColumns,
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem><Link href={`/admin/org/events/${row.original.id}`} className="w-full">View Details</Link></DropdownMenuItem>
            <DropdownMenuItem><Link href={`/admin/org/events/${row.original.id}/edit`} className="w-full">Edit</Link></DropdownMenuItem>
            <DropdownMenuItem><Link href={`/admin/org/events/${row.original.id}/registrations`} className="w-full">Registrations</Link></DropdownMenuItem>
            <DropdownMenuItem><Link href={`/admin/org/events/${row.original.id}/check-in`} className="w-full">Check-in</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              if (!currentOrganizationId) return
              const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${row.original.id}/duplicate`, { method: "POST" })
              const json = await res.json()
              if (json.success) { toast.success("Event duplicated as draft"); fetchEvents() }
              else toast.error(json.message || "Failed to duplicate")
            }}>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Cancel Event</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [currentOrganizationId, fetchEvents])

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
        <StatCard title="Total" value={String(stats.total)} icon={Calendar} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Published" value={String(stats.published)} icon={Calendar} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Ongoing" value={String(stats.ongoing)} icon={Calendar} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard title="Completed" value={String(stats.completed)} icon={Calendar} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
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
          data={events}
          isLoading={isLoading}
          pagination={{ page, pageSize, total }}
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
        events.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="font-medium">No events yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first event to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link key={event.id} href={`/admin/org/events/${event.id}`}>
                <div className="rounded-lg border p-4 hover:border-primary transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium truncate">{event.title}</p>
                    {event.isFeatured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(event.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={statusColors[event.status] || ""}>{event.status.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-muted-foreground">{event.currentRegistrations} registrations</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  )
}

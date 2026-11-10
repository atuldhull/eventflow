"use client"

import { Suspense, useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import {
  Calendar, Plus, MoreHorizontal, Star, LayoutGrid, List, Search,
  Eye, Pencil, Users, QrCode, Copy, XCircle, Rocket,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTable } from "@/components/tables/DataTable"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { statusLabel, statusTone } from "@/lib/status-tone"
import { cn } from "@/lib/utils"
import {
  CancelEventDialog, Registered, ZoneNote, enumLabel, fmtDay, fmtTime, rejectionLine, type ApprovalRejection,
} from "./_components/event-admin"

interface EventRow {
  id: string
  title: string
  slug: string
  category: string | null
  status: string
  type: string
  startDate: string
  timezone?: string | null
  currentRegistrations: number
  maxCapacity: number | null
  isPaid: boolean
  isFeatured: boolean
  visibility: string
  approvalRejection?: ApprovalRejection | null
}

/** A calm one-line notice under a rejected draft: what the enterprise said; Edit / Publish resubmit it. */
const RejectedNote = ({ rejection, className }: { rejection: ApprovalRejection; className?: string }) => (
  <p className={cn("line-clamp-2 text-[13px] text-pill-warning-foreground", className)} title={rejectionLine(rejection)}>
    {rejectionLine(rejection)}
  </p>
)

const FeaturedMark = () => (
  <Star className="size-3.5 shrink-0 fill-current text-warning" aria-label="Featured" role="img" />
)

const staticColumns: ColumnDef<EventRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Event",
    meta: { className: "min-w-[220px]" },
    cell: ({ row }) => {
      const e = row.original
      return (
        <div className="min-w-0 py-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/admin/org/events/${e.id}`} className="truncate font-medium hover:underline hover:underline-offset-4">
              {e.title}
            </Link>
            {e.isFeatured && <FeaturedMark />}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {fmtDay(e.startDate, e.timezone)} · {fmtTime(e.startDate, e.timezone)}
            <ZoneNote timeZone={e.timezone} at={e.startDate} className="before:content-['_·_']" />
            <span className="md:hidden">{e.category ? ` · ${enumLabel(e.category)}` : ""} · {e.isPaid ? "Paid" : "Free"}</span>
          </p>
          {e.approvalRejection && <RejectedNote rejection={e.approvalRejection} className="mt-1 max-w-[52ch] whitespace-normal" />}
        </div>
      )
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    meta: { className: "max-md:hidden" },
    cell: ({ getValue }) => {
      const cat = getValue() as string | null
      return cat ? <span className="text-muted-foreground">{enumLabel(cat)}</span> : <span className="text-faint">—</span>
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue() as string
      return <Pill tone={statusTone(status)}>{statusLabel(status)}</Pill>
    },
  },
  {
    id: "registrations",
    header: "Registrations",
    meta: { className: "w-[168px] min-w-[132px]" },
    cell: ({ row }) => <Registered count={row.original.currentRegistrations} capacity={row.original.maxCapacity} />,
  },
  {
    // The list API returns whether tickets are paid, not an amount.
    id: "revenue",
    header: "Pricing",
    meta: { align: "right", className: "max-md:hidden" },
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.isPaid ? "Paid" : "Free"}</span>,
  },
]

// Status filter: each option is one or more event statuses (sent as a comma list).
const STATUS_FILTERS = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Drafts" },
  // Listed when the enterprise requires approval, or when some event is waiting for it.
  { value: "PENDING_APPROVAL", label: "Pending approval" },
  { value: "PUBLISHED,REGISTRATION_OPEN,REGISTRATION_CLOSED", label: "Published" },
  { value: "ONGOING", label: "Ongoing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const

/** ?status=DRAFT (from the overview) selects the filter that contains it. */
function filterFor(status: string | null): string {
  if (!status) return "ALL"
  return STATUS_FILTERS.find((f) => f.value === status || f.value.split(",").includes(status))?.value ?? "ALL"
}

export default function OrgEventsPage() {
  return (
    <Suspense>
      <OrgEvents />
    </Suspense>
  )
}

function OrgEvents() {
  const initialStatus = useSearchParams().get("status")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState(() => filterFor(initialStatus))
  const [view, setView] = useState<"table" | "card">("table")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const { currentOrganizationId } = useRBAC()

  const [events, setEvents] = useState<EventRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, published: 0, ongoing: 0, completed: 0, pendingApproval: 0 })
  const [approvalRequired, setApprovalRequired] = useState(false)
  const [toCancel, setToCancel] = useState<EventRow | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!currentOrganizationId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim())
      if (status !== "ALL") params.set("status", status)
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/events?${params}`)
      const json = await res.json()
      if (json.success) {
        setEvents(json.data)
        setTotal(json.pagination.total)
        // Counts across all of the organization's events, from the API
        setStats({
          total: json.stats?.total ?? json.pagination.total,
          published: json.stats?.published ?? 0,
          ongoing: json.stats?.ongoing ?? 0,
          completed: json.stats?.completed ?? 0,
          pendingApproval: json.stats?.pendingApproval ?? 0,
        })
        setApprovalRequired(json.approvalRequired === true)
      } else {
        toast.error(json.message || "Failed to load events")
      }
    } catch {
      toast.error("Failed to load events")
    } finally {
      setIsLoading(false)
    }
  }, [currentOrganizationId, page, pageSize, debouncedSearch, status])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const duplicateEvent = useCallback(async (event: EventRow) => {
    if (!currentOrganizationId) return
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${event.id}/duplicate`, { method: "POST" })
      const json = await res.json()
      if (json.success) { toast.success("Event duplicated as draft"); fetchEvents() }
      else toast.error(json.message || "Failed to duplicate")
    } catch { toast.error("Failed to duplicate") }
  }, [currentOrganizationId, fetchEvents])

  const publishEvent = useCallback(async (event: EventRow) => {
    if (!currentOrganizationId) return
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${event.id}/publish`, { method: "POST" })
      const json = await res.json()
      if (json.success) {
        toast.success(json.data?.status === "PENDING_APPROVAL" ? `${event.title} was sent for approval` : `${event.title} is published`)
        fetchEvents()
      }
      else toast.error(json.message || "Failed to publish")
    } catch { toast.error("Failed to publish") }
  }, [currentOrganizationId, fetchEvents])

  const columns = useMemo<ColumnDef<EventRow, unknown>[]>(() => [
    ...staticColumns,
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { align: "right", className: "w-12" },
      cell: ({ row }) => (
        <EventRowMenu event={row.original} onDuplicate={duplicateEvent} onPublish={publishEvent} onCancel={setToCancel} />
      ),
    },
  ], [duplicateEvent, publishEvent])

  const filtered = !!debouncedSearch.trim() || status !== "ALL"
  // The approval queue is part of the page only where it applies.
  const showApproval = approvalRequired || stats.pendingApproval > 0 || status === "PENDING_APPROVAL"
  const statusFilters = STATUS_FILTERS.filter((f) => f.value !== "PENDING_APPROVAL" || showApproval)
  const emptyCopy = filtered
    ? { title: "No events match", description: "Try a different title or status." }
    : { title: "No events yet", description: "Create your first event to get started." }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description={
          isLoading && total === 0
            ? "Loading events…"
            : `${stats.total.toLocaleString("en-IN")} event${stats.total === 1 ? "" : "s"} · ${stats.published} published`
        }
        actions={
          <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
            <Link href="/admin/org/events/create" className={buttonVariants()}>
              <Plus /> Create event
            </Link>
          </PermissionGate>
        }
      />

      <KpiStrip
        isLoading={isLoading && total === 0}
        items={[
          { label: "Total", value: stats.total.toLocaleString("en-IN") },
          { label: "Published", value: stats.published.toLocaleString("en-IN") },
          { label: "Ongoing", value: stats.ongoing.toLocaleString("en-IN") },
          ...(showApproval
            ? [{ label: "Pending approval", value: stats.pendingApproval.toLocaleString("en-IN"), caption: "awaiting enterprise" }]
            : [{ label: "Completed", value: stats.completed.toLocaleString("en-IN") }]),
        ]}
      />

      {stats.pendingApproval > 0 && status !== "PENDING_APPROVAL" && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border bg-raised px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <Pill tone={statusTone("PENDING_APPROVAL")}>{statusLabel("PENDING_APPROVAL")}</Pill>
            <span>
              <span className="font-medium tabular-nums">{stats.pendingApproval.toLocaleString("en-IN")}</span>{" "}
              {stats.pendingApproval === 1 ? "event is" : "events are"} waiting for your enterprise to approve {stats.pendingApproval === 1 ? "it" : "them"}.
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={() => { setStatus("PENDING_APPROVAL"); setPage(1) }}>Show them</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 basis-full sm:max-w-sm sm:flex-1 sm:basis-auto">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            type="search"
            aria-label="Search events"
            placeholder="Search events…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v || "ALL"); setPage(1) }}>
          <SelectTrigger aria-label="Filter by status" className="w-44 shrink-0">
            <SelectValue>{(v: string) => STATUS_FILTERS.find((s) => s.value === v)?.label ?? "All statuses"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
                {s.value === "PENDING_APPROVAL" && stats.pendingApproval > 0 && (
                  <span className="ml-1 text-muted-foreground tabular-nums">{stats.pendingApproval}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex shrink-0 rounded-md border p-0.5" role="group" aria-label="Layout">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Table view"
            aria-pressed={view === "table"}
            className={cn("rounded-sm text-muted-foreground", view === "table" && "bg-accent text-foreground")}
            onClick={() => setView("table")}
          >
            <List />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Card view"
            aria-pressed={view === "card"}
            className={cn("rounded-sm text-muted-foreground", view === "card" && "bg-accent text-foreground")}
            onClick={() => setView("card")}
          >
            <LayoutGrid />
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
            <div className="flex flex-col items-center py-4">
              <p className="text-[15px] font-medium">{emptyCopy.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{emptyCopy.description}</p>
              {!filtered && (
                <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
                  <Link href="/admin/org/events/create" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
                    <Plus /> Create event
                  </Link>
                </PermissionGate>
              )}
            </div>
          }
        />
      ) : isLoading && events.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading events">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[132px] rounded-lg" />)}
        </div>
      ) : events.length === 0 ? (
        <EmptyState icon={Calendar} title={emptyCopy.title} description={emptyCopy.description} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="relative gap-0 p-4 transition-colors hover:bg-muted/40">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/admin/org/events/${event.id}`}
                  className="min-w-0 truncate text-sm font-medium after:absolute after:inset-0 after:content-['']"
                >
                  {event.title}
                </Link>
                {event.isFeatured && <FeaturedMark />}
              </div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {fmtDay(event.startDate, event.timezone)} · {fmtTime(event.startDate, event.timezone)}
                <ZoneNote timeZone={event.timezone} at={event.startDate} className="before:content-['_·_']" />
              </p>
              {event.approvalRejection && <RejectedNote rejection={event.approvalRejection} className="mt-2" />}
              <div className="mt-4 flex items-end justify-between gap-4">
                <Registered count={event.currentRegistrations} capacity={event.maxCapacity} suffix="registrations" className="max-w-44 flex-1" />
                <Pill tone={statusTone(event.status)}>{statusLabel(event.status)}</Pill>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CancelEventDialog
        orgId={currentOrganizationId}
        event={toCancel}
        onClose={() => setToCancel(null)}
        onCancelled={fetchEvents}
      />
    </div>
  )
}

function EventRowMenu({
  event,
  onDuplicate,
  onPublish,
  onCancel,
}: {
  event: EventRow
  onDuplicate: (event: EventRow) => void
  onPublish: (event: EventRow) => void
  onCancel: (event: EventRow) => void
}) {
  const base = `/admin/org/events/${event.id}`
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions for ${event.title}`} />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href={base} />}><Eye /> View details</DropdownMenuItem>
        <PermissionGate permission={PERMISSIONS.EVENT_EDIT}>
          <DropdownMenuItem render={<Link href={`${base}/edit`} />}><Pencil /> Edit</DropdownMenuItem>
        </PermissionGate>
        {event.status === "DRAFT" && (
          <PermissionGate permission={PERMISSIONS.EVENT_PUBLISH}>
            <DropdownMenuItem onClick={() => onPublish(event)}><Rocket /> {event.approvalRejection ? "Resubmit for approval" : "Publish"}</DropdownMenuItem>
          </PermissionGate>
        )}
        <DropdownMenuItem render={<Link href={`${base}/registrations`} />}><Users /> Registrations</DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`${base}/check-in`} />}><QrCode /> Check-in</DropdownMenuItem>
        <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
          <DropdownMenuItem onClick={() => onDuplicate(event)}><Copy /> Duplicate</DropdownMenuItem>
        </PermissionGate>
        <PermissionGate permission={PERMISSIONS.EVENT_CANCEL}>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={event.status === "CANCELLED"}
            onClick={() => onCancel(event)}
          >
            <XCircle /> Cancel event
          </DropdownMenuItem>
        </PermissionGate>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

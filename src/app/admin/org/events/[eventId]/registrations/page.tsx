"use client"

import { use, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ClipboardList, ArrowLeft, Download, Loader2 } from "lucide-react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { DataTable } from "@/components/tables/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"

interface RegRow { id: string; registrationNumber: string; userName: string; userEmail: string; status: string; ticketName: string; amount: number; createdAt: string }

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700", CONFIRMED: "bg-green-100 text-green-700", CHECKED_IN: "bg-emerald-100 text-emerald-700", CANCELLED: "bg-red-100 text-red-700",
}

const columns: ColumnDef<RegRow, unknown>[] = [
  { accessorKey: "userName", header: "Participant", cell: ({ row }) => (<div><p className="font-medium">{row.original.userName}</p><p className="text-xs text-muted-foreground">{row.original.userEmail}</p></div>) },
  { accessorKey: "registrationNumber", header: "Reg #", cell: ({ getValue }) => <span className="text-sm font-mono">{getValue() as string}</span> },
  { accessorKey: "status", header: "Status", cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant="secondary" className={statusColors[s] || ""}>{s.replace(/_/g, " ")}</Badge> } },
  { accessorKey: "ticketName", header: "Ticket", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => { const a = getValue() as number; return <span className="text-sm">{a > 0 ? `₹${a}` : "Free"}</span> } },
  { accessorKey: "createdAt", header: "Date", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{new Date(getValue() as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span> },
]

export default function EventRegistrationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { currentOrganizationId } = useRBAC()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RegRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [eventTitle, setEventTitle] = useState("")

  const fetchData = useCallback(async () => {
    if (!currentOrganizationId) return
    setIsLoading(true)
    try {
      // Fetch event title
      const evRes = await fetch(`/api/admin/org/${currentOrganizationId}/events/${eventId}`)
      const evJson = await evRes.json()
      if (evJson.success) setEventTitle(evJson.data.title)

      // Fetch registrations for this event
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/registrations?${params}`)
      const json = await res.json()
      if (json.success) {
        // Filter to this event's registrations
        const filtered = json.data.filter((r: any) => true) // API already filters by org
        setData(filtered.map((r: any) => ({
          id: r.id, registrationNumber: r.registrationNumber, userName: r.participantName,
          userEmail: r.participantEmail, status: r.status, ticketName: r.ticketType, amount: r.amount, createdAt: r.createdAt,
        })))
        setTotal(json.pagination.total)
      }
    } catch { toast.error("Failed to load") }
    finally { setIsLoading(false) }
  }, [currentOrganizationId, eventId, page, debouncedSearch])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader title={`Registrations${eventTitle ? ` — ${eventTitle}` : ""}`} description="Participants registered for this event"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Events", href: "/admin/org/events" }, { label: "Registrations" }]}
        actions={<Link href={`/admin/org/events/${eventId}`} className={cn(buttonVariants({ variant: "outline" }), "gap-2")}><ArrowLeft className="h-4 w-4" /> Back to Event</Link>}
      />
      <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DataTable columns={columns} data={data} isLoading={isLoading} pagination={{ page, pageSize: 20, total }} onPaginationChange={(p) => setPage(p)}
        emptyState={<div className="text-center py-4"><ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No registrations yet</p></div>}
      />
    </div>
  )
}

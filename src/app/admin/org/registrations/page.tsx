"use client"

import { useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { ClipboardList, Download } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useDebounce } from "@/hooks/useDebounce"

interface RegRow {
  id: string
  registrationNumber: string
  participantName: string
  participantEmail: string
  eventTitle: string
  status: string
  ticketType: string
  amount: number
  createdAt: string
}

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  CONFIRMED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  WAITLISTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CHECKED_IN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  REJECTED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  NO_SHOW: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
}

const columns: ColumnDef<RegRow, unknown>[] = [
  {
    accessorKey: "participantName",
    header: "Participant",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.participantName}</p>
        <p className="text-xs text-muted-foreground">{row.original.participantEmail}</p>
      </div>
    ),
  },
  { accessorKey: "eventTitle", header: "Event", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "registrationNumber", header: "Reg #", cell: ({ getValue }) => <span className="text-sm font-mono">{getValue() as string}</span> },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const s = getValue() as string
      return <Badge variant="secondary" className={statusColors[s] || ""}>{s.replace(/_/g, " ")}</Badge>
    },
  },
  { accessorKey: "ticketType", header: "Ticket", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ getValue }) => {
      const a = getValue() as number
      return <span className="text-sm">{a > 0 ? `₹${a}` : "Free"}</span>
    },
  },
  { accessorKey: "createdAt", header: "Date", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue() as string}</span> },
]

export default function OrgRegistrationsPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        description="All registrations across your events"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" }, { label: "Registrations" }]}
        actions={
          <PermissionGate permission={PERMISSIONS.REGISTRATION_EXPORT}>
            <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Export</Button>
          </PermissionGate>
        }
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total" value="0" icon={ClipboardList} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Confirmed" value="0" icon={ClipboardList} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Pending" value="0" icon={ClipboardList} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatCard title="Checked In" value="0" icon={ClipboardList} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
      </div>
      <Input placeholder="Search by name, email, or registration #..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DataTable columns={columns} data={[]} isLoading={false} pagination={{ page, pageSize: 10, total: 0 }} onPaginationChange={(p) => setPage(p)} enableRowSelection
        emptyState={<div className="text-center py-4"><ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No registrations yet</p><p className="text-sm text-muted-foreground">Registrations will appear when participants sign up.</p></div>}
      />
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { CreditCard, Download, IndianRupee, TrendingUp, ArrowDownRight } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useRBAC } from "@/hooks/useRBAC"
import { useDebounce } from "@/hooks/useDebounce"

interface PaymentRow { id: string; paymentNumber: string; participantName: string; eventTitle: string; organization: string; amount: number; status: string; method: string; createdAt: string }
const statusColors: Record<string, string> = { COMPLETED: "bg-green-100 text-green-700", PENDING: "bg-amber-100 text-amber-700", FAILED: "bg-red-100 text-red-700", REFUNDED: "bg-purple-100 text-purple-700" }

const columns: ColumnDef<PaymentRow, unknown>[] = [
  { accessorKey: "paymentNumber", header: "Payment #", cell: ({ getValue }) => <span className="text-sm font-mono">{getValue() as string}</span> },
  { accessorKey: "participantName", header: "Participant", cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span> },
  { accessorKey: "eventTitle", header: "Event", cell: ({ row }) => (<div><p className="text-sm">{row.original.eventTitle}</p><p className="text-xs text-muted-foreground">{row.original.organization}</p></div>) },
  { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => <span className="text-sm font-medium">₹{(getValue() as number).toLocaleString("en-IN")}</span> },
  { accessorKey: "status", header: "Status", cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant="secondary" className={statusColors[s] || ""}>{s}</Badge> } },
  { accessorKey: "method", header: "Method", cell: ({ getValue }) => <Badge variant="outline">{getValue() as string}</Badge> },
  { accessorKey: "createdAt", header: "Date", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{new Date(getValue() as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span> },
]

export default function EnterprisePaymentsPage() {
  const { currentEnterpriseId } = useRBAC()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaymentRow[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ totalRevenue: 0, refunds: 0, pending: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentEnterpriseId) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/payments?${params}`)
      const json = await res.json()
      if (json.success) { setData(json.data); setTotal(json.pagination.total); setStats(json.stats) }
    } catch { toast.error("Failed to load") } finally { setIsLoading(false) }
  }, [currentEnterpriseId, page])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader title="Payments & Finance" description="Financial overview across your enterprise" breadcrumbs={[{ label: "Admin" }, { label: "Enterprise", href: "/admin/enterprise" }, { label: "Payments" }]}
        actions={<Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Export</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString("en-IN")}`} icon={IndianRupee} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Net Revenue" value={`₹${(stats.totalRevenue - stats.refunds).toLocaleString("en-IN")}`} icon={TrendingUp} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Refunds" value={`₹${stats.refunds.toLocaleString("en-IN")}`} icon={ArrowDownRight} iconColor="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
        <StatCard title="Pending" value={String(stats.pending)} icon={CreditCard} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
      </div>
      <Input placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DataTable columns={columns} data={data} isLoading={isLoading} pagination={{ page, pageSize: 20, total }} onPaginationChange={(p) => setPage(p)}
        emptyState={<div className="text-center py-4"><CreditCard className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No payments yet</p></div>}
      />
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { IndianRupee, Download, TrendingUp, ArrowDownRight, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { formatINR } from "@/lib/utils"

interface ReportData {
  totalRevenue: number; totalRefunds: number; netRevenue: number; totalTransactions: number; totalDiscount: number
  byEvent: { title: string; revenue: number; transactions: number }[]
  byMethod: Record<string, number>
  dailyRevenue: { date: string; revenue: number }[]
}

export default function FinancialReportsPage() {
  const { currentOrganizationId } = useRBAC()
  const [data, setData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0] })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0])

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetchReport() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ dateFrom, dateTo })
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/payments/report?${params}`)
        const json = await res.json()
        if (json.success) setData(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchReport()
  }, [currentOrganizationId, dateFrom, dateTo])

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  const d = data || { totalRevenue: 0, totalRefunds: 0, netRevenue: 0, totalTransactions: 0, totalDiscount: 0, byEvent: [], byMethod: {}, dailyRevenue: [] }

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Reports" description="Revenue, refunds, and financial analysis"
        breadcrumbs={[{ label: "Admin" }, { label: "Payments", href: "/admin/org/payments" }, { label: "Reports" }]}
        actions={<PermissionGate permission={PERMISSIONS.PAYMENT_EXPORT}><Button variant="outline" className="gap-2" onClick={() => window.open(`/api/admin/org/${currentOrganizationId}/payments/report?dateFrom=${dateFrom}&dateTo=${dateTo}&format=csv`)}><Download className="h-4 w-4" /> Export CSV</Button></PermissionGate>}
      />

      {/* Date Range */}
      <div className="flex items-end gap-3">
        <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Gross Revenue" value={formatINR(d.totalRevenue)} icon={IndianRupee} iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Discounts" value={formatINR(d.totalDiscount)} icon={ArrowDownRight} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatCard title="Refunds" value={formatINR(d.totalRefunds)} icon={ArrowDownRight} iconColor="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
        <StatCard title="Net Revenue" value={formatINR(d.netRevenue)} icon={TrendingUp} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Transactions" value={String(d.totalTransactions)} icon={IndianRupee} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Event */}
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Revenue by Event</h3>
          {d.byEvent.length > 0 ? (
            <div className="space-y-2">
              {d.byEvent.slice(0, 10).map((ev) => (
                <div key={ev.title} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1 mr-4">{ev.title}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">{ev.transactions} txns</span>
                    <span className="font-medium">{formatINR(ev.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-4">No revenue data for this period</p>}
        </Card>

        {/* Revenue by Payment Method */}
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Revenue by Payment Method</h3>
          {Object.keys(d.byMethod).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(d.byMethod).map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between text-sm">
                  <Badge variant="outline">{method}</Badge>
                  <span className="font-medium">{formatINR(amount as number)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-4">No payment data</p>}
        </Card>
      </div>

      {/* Daily Revenue Trend */}
      {d.dailyRevenue.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-4">Daily Revenue</h3>
          <div className="space-y-1">
            {d.dailyRevenue.map((day) => (
              <div key={day.date} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{new Date(day.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <span className="font-medium">{formatINR(day.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

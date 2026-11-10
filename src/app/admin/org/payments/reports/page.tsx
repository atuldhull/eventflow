"use client"

import { useState, useEffect } from "react"
import { ChevronDown, Download } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { AreaChart } from "@/components/charts/AreaChart"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { useRBAC } from "@/hooks/useRBAC"
import { cn, formatINR } from "@/lib/utils"
import { statusLabel } from "@/lib/status-tone"

/** The shape getRevenueReport (src/lib/financial-reports.ts) returns, plus the daily series. */
interface ReportData {
  totalRevenue: number; totalRefunds: number; netRevenue: number; totalTransactions: number; totalDiscount: number
  byEvent: { eventId: string; eventTitle: string; revenue: number; transactions: number }[]
  byMethod: { method: string; revenue: number; count: number }[]
  dailyRevenue: { date: string; revenue: number }[]
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 px-5 pt-4 pb-2">
      <h3 className="mb-2 text-[15px] font-semibold">{title}</h3>
      {children}
    </Card>
  )
}

function Bar({ share }: { share: number }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-[2px] bg-muted">
      <div className="h-full rounded-[2px] bg-brand" style={{ width: `${Math.max(0, Math.min(100, share * 100))}%` }} />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-4 py-2">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}
    </div>
  )
}

export default function FinancialReportsPage() {
  const { currentOrganizationId } = useRBAC()
  const [data, setData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
        if (json.success) { setData(json.data); setError(null) }
        else { setData(null); setError(json.message || "Could not load the report") }
      } catch { setError("Could not load the report") } finally { setIsLoading(false) }
    }
    fetchReport()
  }, [currentOrganizationId, dateFrom, dateTo])

  const d: ReportData = data || { totalRevenue: 0, totalRefunds: 0, netRevenue: 0, totalTransactions: 0, totalDiscount: 0, byEvent: [], byMethod: [], dailyRevenue: [] }
  const events = d.byEvent.slice(0, 10)
  const maxEvent = Math.max(1, ...events.map((e) => e.revenue))
  const methods = d.byMethod
  const methodTotal = methods.reduce((sum, m) => sum + m.revenue, 0) || 1
  const rangeQuery = new URLSearchParams({ dateFrom, dateTo }).toString()
  const validRange = Boolean(dateFrom && dateTo && dateFrom <= dateTo)
  const daily = d.dailyRevenue.map((day) => ({
    day: new Date(day.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    revenue: day.revenue,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial reports"
        description="Revenue, refunds, and financial analysis"
        breadcrumbs={[{ label: "Payments", href: "/admin/org/payments" }, { label: "Reports" }]}
        actions={
          <PermissionGate permission={PERMISSIONS.PAYMENT_EXPORT}>
            {/* plain download links: the server sends each file as an attachment */}
            <a
              href={`/api/admin/org/${currentOrganizationId}/payments/invoices?${rangeQuery}`}
              download
              aria-disabled={!currentOrganizationId || !validRange}
              className={cn(buttonVariants({ variant: "ghost" }), (!currentOrganizationId || !validRange) && "pointer-events-none opacity-50")}
            >
              Invoices CSV
            </a>
            <a
              href={`/api/admin/org/${currentOrganizationId}/payments/report?${rangeQuery}&format=csv`}
              download
              aria-disabled={!currentOrganizationId || !validRange}
              className={cn(buttonVariants({ variant: "outline" }), (!currentOrganizationId || !validRange) && "pointer-events-none opacity-50")}
            >
              <Download /> Export CSV
            </a>
          </PermissionGate>
        }
      />

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid flex-1 gap-1.5 sm:w-44 sm:flex-none">
          <Label htmlFor="report-from" className="text-[13px] font-normal text-muted-foreground">From</Label>
          <Input id="report-from" type="date" max={dateTo} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="tabular-nums" />
        </div>
        <div className="grid flex-1 gap-1.5 sm:w-44 sm:flex-none">
          <Label htmlFor="report-to" className="text-[13px] font-normal text-muted-foreground">To</Label>
          <Input id="report-to" type="date" min={dateFrom} value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="tabular-nums" />
        </div>
      </div>

      {error && !isLoading && (
        <p role="alert" className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      <KpiStrip
        isLoading={isLoading}
        items={[
          { label: "Gross revenue", value: formatINR(d.totalRevenue) },
          { label: "Discounts", value: formatINR(d.totalDiscount) },
          { label: "Refunds", value: formatINR(d.totalRefunds) },
          { label: "Net revenue", value: formatINR(d.netRevenue) },
          { label: "Transactions", value: d.totalTransactions.toLocaleString("en-IN") },
        ]}
      />

      {(isLoading || daily.length > 0) && (
        <div className="space-y-2">
          <AreaChart
            title="Daily revenue"
            data={daily}
            xKey="day"
            yKeys={[{ key: "revenue", label: "Revenue", color: "var(--chart-1)" }]}
            height={240}
            isLoading={isLoading}
          />
          {!isLoading && (
            <details className="group rounded-lg border">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-[13px] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                Daily figures
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="divide-y divide-rule border-t border-rule text-sm">
                {d.dailyRevenue.map((day) => (
                  <li key={day.date} className="flex items-center justify-between px-4 py-2">
                    <span className="text-muted-foreground tabular-nums">{new Date(day.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    <span className="font-medium tabular-nums">{formatINR(day.revenue)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Revenue by event">
          {isLoading ? <ListSkeleton /> : events.length > 0 ? (
            <ul className="divide-y divide-rule">
              {events.map((ev) => (
                <li key={ev.eventId} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="min-w-0 truncate">{ev.eventTitle}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="mr-3 text-xs text-muted-foreground">{ev.transactions} txns</span>
                      <span className="font-medium">{formatINR(ev.revenue)}</span>
                    </span>
                  </div>
                  <Bar share={ev.revenue / maxEvent} />
                </li>
              ))}
            </ul>
          ) : <p className="py-8 text-center text-[13px] text-muted-foreground">No revenue data for this period</p>}
        </Panel>

        <Panel title="Revenue by payment method">
          {isLoading ? <ListSkeleton /> : methods.length > 0 ? (
            <ul className="divide-y divide-rule">
              {methods.map((m) => (
                <li key={m.method} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span>{statusLabel(m.method)}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="mr-3 text-xs text-muted-foreground">{m.count} txns</span>
                      <span className="font-medium">{formatINR(m.revenue)}</span>
                    </span>
                  </div>
                  <Bar share={m.revenue / methodTotal} />
                </li>
              ))}
            </ul>
          ) : <p className="py-8 text-center text-[13px] text-muted-foreground">No payment data</p>}
        </Panel>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { BarChart3, Download } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTable } from "@/components/tables/DataTable"
import { BarChart } from "@/components/charts/BarChart"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/permissions"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { useRBAC } from "@/hooks/useRBAC"
import { usePermissions } from "@/hooks/usePermissions"

interface AnalyticsData {
  overview: { totalEvents: number; totalRegistrations: number; totalRevenue: number; attendanceRate: number; avgRating: number; returningParticipants?: number }
  // getOrgAnalytics (src/lib/analytics.ts) returns each row's id as `eventId`
  eventPerformance: { eventId: string; title: string; registrations: number; capacity: number | null; checkIns: number; revenue: number; status: string }[]
  categoryBreakdown: { category: string; events: number; registrations: number }[]
}

type EventRow = AnalyticsData["eventPerformance"][number]

// "—" for a metric the API does not provide (e.g. returningParticipants) instead of crashing
const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("en-IN") : "—")
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")

const columns: ColumnDef<EventRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => <span className="block max-w-[320px] truncate font-medium">{row.original.title}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Pill tone={statusTone(row.original.status)}>{statusLabel(row.original.status)}</Pill>,
  },
  {
    accessorKey: "registrations",
    header: "Registrations",
    meta: { align: "right" },
    cell: ({ row }) => {
      const { registrations, capacity } = row.original
      return (
        <span>
          {n(registrations)}
          {capacity ? <span className="text-muted-foreground"> / {n(capacity)}</span> : null}
        </span>
      )
    },
  },
  { accessorKey: "checkIns", header: "Check-ins", meta: { align: "right" }, cell: ({ row }) => n(row.original.checkIns) },
  {
    id: "attendance",
    header: "Attendance",
    meta: { align: "right" },
    cell: ({ row }) => {
      const { registrations, checkIns } = row.original
      const att = registrations > 0 ? Math.round((checkIns / registrations) * 100) : 0
      return `${att}%`
    },
  },
  {
    accessorKey: "revenue",
    header: "Revenue",
    meta: { align: "right" },
    cell: ({ row }) =>
      row.original.revenue > 0 ? (
        <span className="font-medium">₹{n(row.original.revenue)}</span>
      ) : (
        <span className="text-muted-foreground">Free</span>
      ),
  },
]

export default function OrgAnalyticsPage() {
  const { currentOrganizationId, accessibleOrganizations } = useRBAC()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/analytics`)
        const json = await res.json()
        if (json.success) setData(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchAnalytics()
  }, [currentOrganizationId])

  const ov = data?.overview || { totalEvents: 0, totalRegistrations: 0, totalRevenue: 0, attendanceRate: 0, avgRating: 0, returningParticipants: 0 }
  const events = data?.eventPerformance ?? []
  const categories = data?.categoryBreakdown ?? []
  const maxCategory = Math.max(1, ...categories.map((c) => c.registrations))
  // Revenue is shown to the same people as before (PAYMENT_VIEW)
  const canSeeRevenue = !permissionsLoading && hasPermission(PERMISSIONS.PAYMENT_VIEW)

  const kpis = [
    { label: "Events", value: n(ov.totalEvents) },
    { label: "Registrations", value: n(ov.totalRegistrations) },
    ...(canSeeRevenue ? [{ label: "Revenue", value: `₹${n(ov.totalRevenue)}` }] : []),
    { label: "Attendance", value: `${ov.attendanceRate}%` },
    { label: "Avg rating", value: ov.avgRating ? ov.avgRating.toFixed(1) : "—" },
    { label: "Returning", value: n(ov.returningParticipants), caption: "participants" },
  ]

  const chartData = events.slice(0, 8).map((e) => ({
    name: e.title.length > 16 ? `${e.title.slice(0, 15)}…` : e.title,
    registrations: e.registrations,
    checkIns: e.checkIns,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`${org?.name || "Organization"} · performance across your events`}
        actions={
          <PermissionGate permission={PERMISSIONS.ANALYTICS_EXPORT}>
            <Button variant="outline" onClick={() => window.open(`/api/admin/org/${currentOrganizationId}/analytics/export`)}>
              <Download /> Export report
            </Button>
          </PermissionGate>
        }
      />

      <KpiStrip isLoading={isLoading} items={kpis} />

      {(isLoading || events.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <BarChart
            title="Registrations and check-ins"
            data={chartData}
            xKey="name"
            yKeys={[
              { key: "registrations", label: "Registrations", color: "var(--chart-1)" },
              { key: "checkIns", label: "Check-ins", color: "var(--chart-2)" },
            ]}
            height={260}
            isLoading={isLoading}
          />

          <Card className="gap-0 px-5 pt-4 pb-2">
            <h3 className="mb-3 text-[15px] font-semibold">By category</h3>
            {isLoading ? (
              <div className="space-y-4 py-1">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : categories.length > 0 ? (
              <ul className="divide-y divide-rule">
                {categories.map((cat) => (
                  <li key={cat.category} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{titleCase(cat.category)}</span>
                      <span className="shrink-0 tabular-nums">
                        {n(cat.registrations)}
                        <span className="ml-1 text-[13px] text-muted-foreground">registrations</span>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-[2px] bg-muted">
                        <div className="h-full rounded-[2px] bg-brand" style={{ width: `${(cat.registrations / maxCategory) * 100}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {cat.events} event{cat.events !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-[13px] text-muted-foreground">No categories yet</p>
            )}
          </Card>
        </div>
      )}

      <section aria-labelledby="perf-heading" className="space-y-3">
        <h2 id="perf-heading" className="text-[15px] font-semibold">Event performance</h2>
        <DataTable
          columns={columns}
          data={events}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={BarChart3}
              title="No event data yet"
              description="Create and publish events to see performance analytics."
              className="border-0 py-6"
            />
          }
        />
      </section>
    </div>
  )
}

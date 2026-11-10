"use client"

import { useState, useEffect } from "react"
import { Calendar, Download } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { useRBAC } from "@/hooks/useRBAC"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { BlockHeading, RowsSkeleton, inr, num } from "../_components/admin-ui"

interface RecentEvent {
  id: string
  title: string
  status: string
  organization?: string
  // the stats route sends date / registrations; older shapes used startDate / currentRegistrations
  date?: string
  startDate?: string
  registrations?: number
  currentRegistrations?: number
}

export default function EnterpriseAnalyticsPage() {
  const { currentEnterpriseId, accessibleEnterprises } = useRBAC()
  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)
  const [stats, setStats] = useState({ organizationCount: 0, eventCount: 0, registrationCount: 0, totalRevenue: 0 })
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentEnterpriseId) return
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/dashboard-stats`)
        const json = await res.json()
        if (json.success) {
          setStats({
            organizationCount: json.data.organizationCount ?? json.data.orgCount ?? 0,
            eventCount: json.data.eventCount ?? 0,
            registrationCount: json.data.registrationCount ?? 0,
            totalRevenue: json.data.totalRevenue || 0,
          })
          setRecentEvents(json.data.recentEvents || [])
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetchAnalytics()
  }, [currentEnterpriseId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`${enterprise?.name || "Enterprise"} performance overview`}
        actions={<Button variant="outline"><Download /> Export report</Button>}
      />

      <KpiStrip
        isLoading={isLoading}
        items={[
          { label: "Organizations", value: num(stats.organizationCount) },
          { label: "Events", value: num(stats.eventCount) },
          { label: "Registrations", value: num(stats.registrationCount) },
          { label: "Revenue", value: inr(stats.totalRevenue) },
        ]}
      />

      <section aria-labelledby="events-heading">
        <BlockHeading id="events-heading" title="Upcoming events across the enterprise" href="/admin/enterprise/events" linkLabel="All events" />
        {isLoading ? (
          <Card className="gap-0 p-0"><RowsSkeleton rows={4} /></Card>
        ) : recentEvents.length > 0 ? (
          <Card className="gap-0 overflow-hidden p-0">
            <ul className="divide-y divide-rule">
              {recentEvents.map((event) => {
                const start = new Date(event.startDate ?? event.date ?? "")
                const valid = !Number.isNaN(start.getTime())
                const regs = event.currentRegistrations ?? event.registrations ?? 0
                return (
                  <li key={event.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex w-11 shrink-0 flex-col items-center rounded-md bg-muted py-1 leading-none" aria-hidden>
                      <span className="text-[11px] text-muted-foreground">{valid ? start.toLocaleDateString("en-IN", { month: "short" }) : "—"}</span>
                      <span className="mt-0.5 text-[17px] font-semibold tabular-nums">{valid ? start.getDate() : ""}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground tabular-nums">
                        {valid && <span className="sr-only">{start.toLocaleDateString("en-IN", { day: "numeric", month: "long" })} · </span>}
                        {event.organization ? `${event.organization} · ` : ""}
                        {num(regs)} registration{regs === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Pill tone={statusTone(event.status)} className="shrink-0">{statusLabel(event.status)}</Pill>
                  </li>
                )
              })}
            </ul>
          </Card>
        ) : (
          <EmptyState
            icon={Calendar}
            title="No events yet"
            description="Create events within your organizations to see analytics."
          />
        )}
      </section>
    </div>
  )
}

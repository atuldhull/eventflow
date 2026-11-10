"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { BlockHeading, RowsSkeleton, fmtDate, fmtDateTime, inr, num } from "@/app/admin/enterprise/_components/admin-ui"

// The stats route sends date / registrations / organizer and user; older shapes used other names.
interface RecentEvent { id: string; title: string; status: string; organizer?: string; date?: string; startDate?: string; registrations?: number; currentRegistrations?: number }
interface Activity { id: string; action: string; description?: string; user?: string; userName?: string; createdAt: string }

export default function SuperAdminAnalyticsPage() {
  const [stats, setStats] = useState({ totalUsers: 0, totalEvents: 0, activeEnterprises: 0, totalRevenue: 0 })
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [recentActivity, setRecentActivity] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch("/api/super-admin/dashboard-stats")
        const json = await res.json()
        if (json.success) {
          setStats(json.data)
          setRecentEvents(json.data.recentEvents || [])
          setRecentActivity(json.data.recentActivity || [])
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Platform-wide performance overview" />

      <KpiStrip
        isLoading={isLoading}
        items={[
          { label: "Users", value: num(stats.totalUsers) },
          { label: "Events", value: num(stats.totalEvents) },
          { label: "Enterprises", value: num(stats.activeEnterprises), caption: "Active" },
          { label: "Revenue", value: inr(stats.totalRevenue), caption: "All time" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="events-heading" className="min-w-0">
          <BlockHeading id="events-heading" title="Recent events" href="/super-admin/events" linkLabel="All events" />
          <Card className="gap-0 p-0">
            {isLoading ? (
              <RowsSkeleton rows={4} />
            ) : recentEvents.length > 0 ? (
              <ul className="divide-y divide-rule">
                {recentEvents.map((e) => {
                  const regs = e.currentRegistrations ?? e.registrations ?? 0
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <p className="mt-0.5 truncate text-[13px] text-muted-foreground tabular-nums">
                          {fmtDate(e.startDate ?? e.date)}
                          {e.organizer ? ` · ${e.organizer}` : ""} · {num(regs)} registration{regs === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Pill tone={statusTone(e.status)} className="shrink-0">{statusLabel(e.status)}</Pill>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No events yet</p>
            )}
          </Card>
        </section>

        <section aria-labelledby="activity-heading" className="min-w-0">
          <BlockHeading id="activity-heading" title="Recent activity" href="/super-admin/audit" linkLabel="Audit log" />
          <Card className="gap-0 p-0">
            {isLoading ? (
              <RowsSkeleton rows={4} />
            ) : recentActivity.length > 0 ? (
              <ol className="divide-y divide-rule">
                {recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm">{a.description || a.action}</p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
                        {a.userName ?? a.user ?? "—"} · {fmtDateTime(a.createdAt)}
                      </p>
                    </div>
                    <Pill className="shrink-0">{statusLabel(a.action)}</Pill>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No activity yet</p>
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}

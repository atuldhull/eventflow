"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { Card } from "@/components/ui/card"
import { Pill, type Tone } from "@/components/ui/pill"
import { statusLabel } from "@/lib/status-tone"
import { BlockHeading, LinkRow, inr, num } from "@/app/admin/enterprise/_components/admin-ui"

interface Health {
  status?: string
  checks?: { database?: { status?: string }; email?: { status?: string } }
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalEvents: 0, activeEnterprises: 0, totalRevenue: 0 })
  const [health, setHealth] = useState<Health | null>(null)
  const [healthChecked, setHealthChecked] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/super-admin/dashboard-stats")
        const json = await res.json()
        if (json.success) setStats(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    async function fetchHealth() {
      try { const res = await fetch("/api/health"); const json = await res.json(); setHealth(json) } catch {} finally { setHealthChecked(true) }
    }
    fetchStats()
    fetchHealth()
  }, [])

  const checking = !healthChecked
  const dbUp = health?.checks?.database?.status === "up"
  const emailStatus = health?.checks?.email?.status
  const rows: { label: string; tone: Tone; value: string }[] = [
    { label: "Database", tone: checking ? "neutral" : dbUp ? "positive" : "negative", value: checking ? "Checking…" : dbUp ? "Connected" : "Down" },
    { label: "Email service", tone: emailStatus === "configured" ? "positive" : emailStatus ? "warning" : "neutral", value: emailStatus ? statusLabel(emailStatus) : "Checking…" },
    { label: "Overall", tone: health?.status === "healthy" ? "positive" : health?.status ? "warning" : "neutral", value: health?.status ? statusLabel(health.status) : "Checking…" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Platform" description="Overview of the EventFlow platform" />

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
        <section aria-labelledby="links-heading" className="min-w-0">
          <BlockHeading id="links-heading" title="Go to" />
          <Card className="gap-0 overflow-hidden p-0">
            <ul className="divide-y divide-rule">
              <LinkRow href="/super-admin/enterprises" label="Enterprises" description="Universities, companies and other tenants" />
              <LinkRow href="/super-admin/users" label="Users" description="Every account on the platform" />
              <LinkRow href="/super-admin/analytics" label="Analytics" description="Platform-wide performance" />
              <LinkRow href="/super-admin/audit" label="Audit log" description="Every action, everywhere" />
            </ul>
          </Card>
        </section>

        <section aria-labelledby="health-heading" className="min-w-0">
          <BlockHeading id="health-heading" title="System health" />
          <Card className="gap-0 p-0">
            <dl className="divide-y divide-rule">
              {rows.map((r) => (
                <div key={r.label} className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
                  <dt className="text-sm text-muted-foreground">{r.label}</dt>
                  <dd><Pill tone={r.tone} dot>{r.value}</Pill></dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      </div>
    </div>
  )
}

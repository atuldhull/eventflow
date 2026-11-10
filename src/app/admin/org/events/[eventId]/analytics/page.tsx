"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, BarChart3 } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useRBAC } from "@/hooks/useRBAC"
import { CapacityBar, inr } from "../../_components/event-admin"

/** GET /api/admin/org/:orgId/events/:eventId/analytics (money fields are null without payment access). */
interface EventAnalytics {
  title: string
  overview: { registrations: number; confirmed: number; checkIns: number; revenue: number | null; attendanceRate: number; avgRating: number; feedbackCount: number }
  statusDistribution: { confirmed: number; pending: number; waitlisted: number; cancelled: number; checkedIn: number }
  ticketDistribution: { ticketType: string; count: number; revenue: number | null }[]
  revenueBreakdown: { gross: number; coupons: number; refunds: number; net: number } | null
  funnel: { registrations: number; confirmed: number; checkedIn: number; feedbackGiven: number }
}

const n = (v: number | null | undefined) => (v || 0).toLocaleString("en-IN")

export default function EventAnalyticsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { currentOrganizationId } = useRBAC()
  const [data, setData] = useState<EventAnalytics | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrganizationId) return
    let cancelled = false
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/events/${eventId}/analytics`)
        const json = await res.json()
        if (!cancelled) setData(json.success ? json.data : null)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoadedFor(currentOrganizationId)
      }
    }
    fetchAnalytics()
    return () => { cancelled = true }
  }, [currentOrganizationId, eventId])

  const isLoading = loadedFor !== currentOrganizationId || !currentOrganizationId
  const o = data?.overview

  if (!isLoading && !data) {
    return (
      <EmptyState variant="page" icon={BarChart3} title="Analytics aren't available." description="The event may have been deleted, or it belongs to another organization.">
        <Link href="/admin/org/events" className={buttonVariants({ variant: "outline" })}>Back to events</Link>
      </EmptyState>
    )
  }

  const funnel = data
    ? [
        { label: "Registrations", count: data.funnel.registrations },
        { label: "Confirmed", count: data.funnel.confirmed },
        { label: "Checked in", count: data.funnel.checkedIn },
        { label: "Gave feedback", count: data.funnel.feedbackGiven },
      ]
    : []
  const funnelMax = Math.max(1, data?.funnel.registrations || 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event analytics"
        description={data?.title ? `${data.title} · registrations, attendance and revenue` : "Registrations, attendance and revenue"}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Events", href: "/admin/org/events" }, { label: "Analytics" }]}
        actions={
          <Link href={`/admin/org/events/${eventId}`} className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft /> Back to event
          </Link>
        }
      />

      <KpiStrip
        isLoading={isLoading}
        items={[
          { label: "Registrations", value: n(o?.registrations) },
          { label: "Confirmed", value: n(o?.confirmed) },
          { label: "Checked in", value: n(o?.checkIns), caption: `${o?.attendanceRate ?? 0}% attendance` },
          ...(o?.revenue !== null && o?.revenue !== undefined ? [{ label: "Revenue", value: inr(o.revenue) }] : []),
          { label: "Avg rating", value: o?.avgRating ? o.avgRating.toFixed(1) : "—", caption: o?.feedbackCount ? `${n(o.feedbackCount)} reviews` : "no feedback yet" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="funnel-heading" className="rounded-lg border px-5 py-5">
          <h2 id="funnel-heading" className="text-[15px] font-semibold">Registration funnel</h2>
          {isLoading ? (
            <div className="mt-4 space-y-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : (
            <dl className="mt-4 space-y-5">
              {funnel.map((step) => (
                <div key={step.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <dt>{step.label}</dt>
                    <dd className="tabular-nums">
                      {n(step.count)} <span className="text-muted-foreground">({Math.round((step.count / funnelMax) * 100)}%)</span>
                    </dd>
                  </div>
                  <CapacityBar value={step.count} max={funnelMax} className="mt-2 h-1.5" />
                </div>
              ))}
            </dl>
          )}
        </section>

        <section aria-labelledby="tickets-heading" className="rounded-lg border px-5 py-5">
          <h2 id="tickets-heading" className="text-[15px] font-semibold">By ticket type</h2>
          {isLoading ? (
            <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : !data?.ticketDistribution.length ? (
            <p className="mt-3 text-sm text-muted-foreground">No registrations yet.</p>
          ) : (
            <dl className="mt-3 divide-y divide-rule">
              {data.ticketDistribution.map((t) => (
                <div key={t.ticketType} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="min-w-0 truncate">{t.ticketType}</dt>
                  <dd className="shrink-0 tabular-nums">
                    {n(t.count)} <span className="text-muted-foreground">registered</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      {data?.revenueBreakdown && (
        <section aria-labelledby="revenue-heading">
          <h2 id="revenue-heading" className="mb-3 text-[15px] font-semibold">Revenue breakdown</h2>
          <KpiStrip
            items={[
              { label: "Gross revenue", value: inr(data.revenueBreakdown.gross) },
              { label: "Discounts", value: inr(data.revenueBreakdown.coupons) },
              { label: "Refunds", value: `−${inr(data.revenueBreakdown.refunds)}` },
              { label: "Net revenue", value: inr(data.revenueBreakdown.net) },
            ]}
          />
        </section>
      )}
    </div>
  )
}

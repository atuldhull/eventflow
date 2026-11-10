"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Calendar, ChevronRight, Plus, QrCode } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { useRBAC } from "@/hooks/useRBAC"
import { PERMISSIONS } from "@/lib/permissions"
import { statusLabel, statusTone } from "@/lib/status-tone"
import { DateBlock, Registered, enumLabel, fmtTime, inr } from "./events/_components/event-admin"

/** GET /api/admin/org/:orgId/overview */
interface Overview {
  events: { total: number; active: number; draft: number }
  registrations: { total: number; thisMonth: number }
  /** null when the viewer may not see payments */
  revenueThisMonth: number | null
  paymentsThisMonth: number | null
  teamMembers: number
  pendingActions: { key: string; label: string; count: number; href: string }[]
  recentActivity: { id: string; action: string; entityType: string; description: string; actor: string | null; createdAt: string; href: string | null }[]
  upcomingEvents: {
    id: string
    title: string
    status: string
    category: string | null
    startDate: string
    timezone?: string | null
    currentRegistrations: number
    maxCapacity: number | null
  }[]
}

const n = (v: number) => v.toLocaleString("en-IN")

/** "just now", "5m ago", "3h ago", "2d ago", then the date. */
function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

export default function OrgDashboard() {
  const { currentOrganizationId, accessibleOrganizations, isLoading: rbacLoading } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const [data, setData] = useState<Overview | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrganizationId) return
    let cancelled = false
    async function fetchOverview() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/overview`)
        const json = await res.json()
        if (!cancelled) setData(json.success ? json.data : null)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoadedFor(currentOrganizationId)
      }
    }
    fetchOverview()
    return () => { cancelled = true }
  }, [currentOrganizationId])

  const isLoading = currentOrganizationId ? loadedFor !== currentOrganizationId : rbacLoading
  const upcomingEvents = data?.upcomingEvents ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={org?.name || "Organization"}
        description={
          isLoading
            ? "Loading your events…"
            : data
              ? `${n(data.events.total)} event${data.events.total === 1 ? "" : "s"} · ${n(data.events.active)} active`
              : "Your events at a glance"
        }
        actions={
          <>
            <PermissionGate permission={PERMISSIONS.CHECKIN_PERFORM}>
              <Link href="/admin/org/check-in" className={buttonVariants({ variant: "outline" })}>
                <QrCode /> Scan QR
              </Link>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
              <Link href="/admin/org/events/create" className={buttonVariants()}>
                <Plus /> Create event
              </Link>
            </PermissionGate>
          </>
        }
      />

      <KpiStrip
        isLoading={isLoading}
        items={[
          {
            label: "Total events",
            value: n(data?.events.total ?? 0),
            caption: `${n(data?.events.active ?? 0)} active${data?.events.draft ? ` · ${n(data.events.draft)} draft` : ""}`,
          },
          {
            label: "Registrations",
            value: n(data?.registrations.total ?? 0),
            caption: `${n(data?.registrations.thisMonth ?? 0)} this month`,
          },
          ...(data && data.revenueThisMonth !== null
            ? [{
                label: "Revenue",
                value: inr(Math.round(data.revenueThisMonth)),
                caption: `this month · ${n(data.paymentsThisMonth ?? 0)} payment${data.paymentsThisMonth === 1 ? "" : "s"}`,
              }]
            : []),
          { label: "Team members", value: n(data?.teamMembers ?? 0), caption: "active" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        {/* Upcoming events */}
        <section aria-labelledby="upcoming-heading" className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="upcoming-heading" className="text-[15px] font-semibold">Upcoming events</h2>
            <Link href="/admin/org/events" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              All events
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-px border-y border-rule" aria-busy="true" aria-label="Loading events">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3.5">
                  <Skeleton className="h-9 w-10" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
                  <Skeleton className="hidden h-4 w-32 sm:block" />
                </div>
              ))}
            </div>
          ) : upcomingEvents.length > 0 ? (
            <ul className="divide-y divide-rule border-y border-rule">
              {upcomingEvents.map((event) => (
                <li key={event.id} className="group relative flex items-center gap-4 px-1 py-3 transition-colors hover:bg-muted/50">
                  <DateBlock date={event.startDate} timeZone={event.timezone} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/org/events/${event.id}`}
                      className="block truncate text-sm font-medium after:absolute after:inset-0 after:content-['']"
                    >
                      {event.title}
                    </Link>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      {[event.category ? enumLabel(event.category) : null, fmtTime(event.startDate, event.timezone)].filter(Boolean).join(" · ")}
                    </p>
                    <Registered count={event.currentRegistrations || 0} capacity={event.maxCapacity} suffix="registered" className="mt-2 max-w-48 sm:hidden" />
                  </div>
                  <Registered count={event.currentRegistrations || 0} capacity={event.maxCapacity} suffix="registered" className="hidden w-40 shrink-0 sm:block" />
                  <div className="flex w-[124px] shrink-0 justify-end max-sm:w-auto">
                    <Pill tone={statusTone(event.status)}>{statusLabel(event.status)}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Calendar} title="No upcoming events" description="Create your next event to get started.">
              <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
                <Link href="/admin/org/events/create" className={buttonVariants({ variant: "outline" })}>
                  <Plus /> Create event
                </Link>
              </PermissionGate>
            </EmptyState>
          )}
        </section>

        {/* Pending actions + recent activity */}
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="pending-heading">
            <h2 id="pending-heading" className="mb-2 text-[15px] font-semibold">Pending actions</h2>
            {isLoading ? (
              <Skeleton className="h-12 rounded-lg" />
            ) : data?.pendingActions.length ? (
              <ul className="divide-y divide-rule overflow-hidden rounded-lg border">
                {data.pendingActions.map((a) => (
                  <li key={a.key}>
                    <Link href={a.href} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50">
                      <span className="min-w-0 flex-1">{a.label}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border px-4 py-3.5 text-sm text-muted-foreground">All caught up.</div>
            )}
          </section>

          <section aria-labelledby="activity-heading">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="activity-heading" className="text-[15px] font-semibold">Recent activity</h2>
              <PermissionGate permission={PERMISSIONS.AUDIT_VIEW}>
                <Link href="/admin/org/audit-logs" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  View all
                </Link>
              </PermissionGate>
            </div>
            {isLoading ? (
              <div className="space-y-3 border-t border-rule pt-3" aria-busy="true" aria-label="Loading activity">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}
              </div>
            ) : data?.recentActivity.length ? (
              <ol className="divide-y divide-rule border-t border-rule">
                {data.recentActivity.map((item) => {
                  const body = (
                    <>
                      <p className="line-clamp-2 text-sm">{item.description}</p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {[item.actor, ago(item.createdAt)].filter(Boolean).join(" · ")}
                      </p>
                    </>
                  )
                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link href={item.href} className="block py-2.5 transition-colors hover:text-foreground hover:[&_p:first-child]:underline hover:[&_p:first-child]:underline-offset-4">
                          {body}
                        </Link>
                      ) : (
                        <div className="py-2.5">{body}</div>
                      )}
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="border-t border-rule pt-3 text-sm text-muted-foreground">No activity yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

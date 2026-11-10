"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Building2, Plus, UserPlus } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { useRBAC } from "@/hooks/useRBAC"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS, getAssignableEnterpriseRoles } from "@/lib/permissions"
import { statusLabel } from "@/lib/status-tone"
import { cn } from "@/lib/utils"
import { BlockHeading, LinkRow, RowsSkeleton, Initial, fmtDateTime, inr, num } from "./_components/admin-ui"
import { CreateEventDialog } from "./_components/create-event-dialog"
import { InviteMemberDialog } from "./_components/invite-member-dialog"

interface OrgRow {
  id: string
  name: string
  slug: string
  category: string | null
  isActive: boolean
  isVerified: boolean
  _count: { events: number; members: number }
}

interface ActivityRow { id: string; user: string; action: string; description: string; createdAt: string }

export default function EnterpriseDashboard() {
  const { currentEnterpriseId, accessibleEnterprises, enterpriseRole, isEnterpriseOwner } = useRBAC()
  const [createEventOpen, setCreateEventOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const enterprise = accessibleEnterprises.find((e) => e.id === currentEnterpriseId)
  const [stats, setStats] = useState({ organizations: 0, events: 0, registrations: 0, revenue: 0 })
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [orgTotal, setOrgTotal] = useState(0)
  const [orgsLoading, setOrgsLoading] = useState(true)

  useEffect(() => {
    if (!currentEnterpriseId) return
    async function fetchStats() {
      try {
        const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/dashboard-stats`)
        const json = await res.json()
        if (json.success) {
          setStats({
            // the stats route names this field orgCount
            organizations: json.data.organizationCount ?? json.data.orgCount ?? 0,
            events: json.data.eventCount || 0,
            registrations: json.data.registrationCount || 0,
            revenue: json.data.totalRevenue ?? 0,
          })
          setActivity(json.data.recentActivity || [])
        }
      } catch {} finally { setIsLoading(false) }
    }
    // The newest organizations, read from the same list the Organizations page shows.
    async function fetchOrgs() {
      try {
        const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/organizations?page=1&limit=6`)
        const json = await res.json()
        if (json.success) {
          setOrgs(json.data)
          setOrgTotal(json.pagination?.total ?? json.data.length)
        }
      } catch {} finally { setOrgsLoading(false) }
    }
    fetchStats()
    fetchOrgs()
  }, [currentEnterpriseId])

  const canSeeRevenue = !permissionsLoading && hasPermission(PERMISSIONS.PAYMENT_VIEW)

  return (
    <div className="space-y-6">
      <PageHeader
        title={enterprise?.name || "Enterprise"}
        description={
          isLoading
            ? "Enterprise overview"
            : `${num(stats.organizations)} active organization${stats.organizations === 1 ? "" : "s"} · ${num(stats.events)} event${stats.events === 1 ? "" : "s"}`
        }
        actions={
          <>
            <PermissionGate permission={PERMISSIONS.EVENT_CREATE}>
              <Button onClick={() => setCreateEventOpen(true)}><Plus /> Create event</Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.MEMBER_INVITE}>
              <Button variant="outline" onClick={() => setInviteOpen(true)}><UserPlus /> Invite member</Button>
            </PermissionGate>
          </>
        }
      />

      <KpiStrip
        isLoading={isLoading}
        items={[
          { label: "Organizations", value: num(stats.organizations), caption: "Active" },
          { label: "Events", value: num(stats.events), caption: "Across all organizations" },
          { label: "Registrations", value: num(stats.registrations), caption: "All time" },
          ...(canSeeRevenue ? [{ label: "Revenue", value: inr(stats.revenue), caption: "All time" }] : []),
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="orgs-heading" className="min-w-0">
          <BlockHeading id="orgs-heading" title="Organizations" href="/admin/enterprise/organizations" linkLabel={orgTotal > orgs.length ? `All ${num(orgTotal)}` : "View all"} />
          {orgsLoading ? (
            <Card className="gap-0 p-0"><RowsSkeleton rows={4} /></Card>
          ) : orgs.length > 0 ? (
            <Card className="gap-0 overflow-hidden p-0">
              <ul className="divide-y divide-rule">
                {orgs.map((org) => (
                  <li key={org.id}>
                    <Link
                      href={`/admin/enterprise/organizations/${org.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                    >
                      <Initial name={org.name} className="size-9 rounded-lg border bg-raised font-display text-base font-bold text-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{org.name}</p>
                        <p className="truncate text-[13px] text-muted-foreground tabular-nums">
                          {org.category ? `${statusLabel(org.category)} · ` : ""}
                          {num(org._count?.events)} event{org._count?.events === 1 ? "" : "s"} · {num(org._count?.members)} member{org._count?.members === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Pill tone={org.isActive ? "positive" : "neutral"} className="shrink-0">{org.isActive ? "Active" : "Inactive"}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState
              icon={Building2}
              title="No organizations yet"
              description="Create your first organization to start managing events."
            >
              <PermissionGate permission={PERMISSIONS.ORG_CREATE}>
                <Link href="/admin/enterprise/organizations/create" className={cn(buttonVariants())}>
                  <Plus /> Create organization
                </Link>
              </PermissionGate>
            </EmptyState>
          )}
        </section>

        <div className="min-w-0 space-y-6">
          <section aria-labelledby="links-heading">
            <BlockHeading id="links-heading" title="Go to" />
            <Card className="gap-0 overflow-hidden p-0">
              <ul className="divide-y divide-rule">
                {/* only destinations this role can open (read-only roles see fewer) */}
                <PermissionGate permission={PERMISSIONS.ORG_VIEW}>
                  <LinkRow href="/admin/enterprise/organizations" label="Organizations" description="Clubs, departments and teams" />
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.EVENT_VIEW}>
                  <LinkRow href="/admin/enterprise/events" label="Events" description="Every event across the enterprise" />
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.MEMBER_VIEW}>
                  <LinkRow href="/admin/enterprise/members" label="Members" description="People who manage the enterprise" />
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.ENTERPRISE_VIEW_ANALYTICS}>
                  <LinkRow href="/admin/enterprise/analytics" label="Analytics" description="Registrations and revenue" />
                </PermissionGate>
              </ul>
            </Card>
          </section>

          <section aria-labelledby="activity-heading">
            <BlockHeading id="activity-heading" title="Recent activity" href="/admin/enterprise/audit-logs" />
            {isLoading ? (
              <Card className="gap-0 p-0"><RowsSkeleton rows={3} /></Card>
            ) : activity.length > 0 ? (
              <Card className="gap-0 p-0">
                <ol className="divide-y divide-rule">
                  {activity.slice(0, 5).map((a) => (
                    <li key={a.id} className="px-4 py-3">
                      <p className="line-clamp-2 text-sm">
                        <span className="font-medium">{a.user}</span>{" "}
                        <span className="text-muted-foreground">{a.description}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{fmtDateTime(a.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              </Card>
            ) : (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Actions will be logged here.
              </p>
            )}
          </section>
        </div>
      </div>

      <CreateEventDialog open={createEventOpen} onOpenChange={setCreateEventOpen} enterpriseId={currentEnterpriseId} />
      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        enterpriseId={currentEnterpriseId}
        assignableRoles={getAssignableEnterpriseRoles(enterpriseRole, isEnterpriseOwner)}
      />
    </div>
  )
}

"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { BadgeCheck, ExternalLink, Pencil } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { KpiStrip } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTable } from "@/components/tables/DataTable"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { useRBAC } from "@/hooks/useRBAC"
import { PERMISSIONS, getRoleLabel } from "@/lib/permissions"
import { statusLabel, statusTone } from "@/lib/status-tone"
import type { Role } from "@/lib/constants"
import { CapacityCell, Initial, PrimaryCell, TableEmpty, fmtDate, inr, num } from "../../_components/admin-ui"

interface OrgEvent { id: string; title: string; status: string; startDate: string; currentRegistrations: number; maxCapacity: number | null; isPaid: boolean }
interface OrgMember { id: string; role: Role; joinedAt: string; name: string; email: string }
interface OrgDetail {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
  website: string | null
  email: string
  phone: string | null
  city: string | null
  state: string | null
  country: string | null
  category: string | null
  isVerified: boolean
  isActive: boolean
  maxEvents: number | null
  createdAt: string
  stats: { events: number; upcomingEvents: number; members: number; registrations: number; revenue: number | null }
  events: OrgEvent[]
  members: OrgMember[]
}

const eventColumns: ColumnDef<OrgEvent, unknown>[] = [
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => <PrimaryCell title={row.original.title} meta={row.original.isPaid ? "Paid" : "Free"} />,
    meta: { className: "min-w-[220px] max-w-[360px]" },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => { const s = getValue() as string; return <Pill tone={statusTone(s)}>{statusLabel(s)}</Pill> },
  },
  {
    accessorKey: "startDate",
    header: "Date",
    cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{fmtDate(getValue() as string, true)}</span>,
  },
  {
    id: "registrations",
    header: "Registrations",
    cell: ({ row }) => <CapacityCell count={row.original.currentRegistrations} capacity={row.original.maxCapacity} />,
    meta: { align: "right" },
  },
]

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 px-4 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  )
}

export default function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params)
  const router = useRouter()
  const { currentEnterpriseId, setOrganizationContext } = useRBAC()
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentEnterpriseId) return
    let cancelled = false
    fetch(`/api/admin/enterprise/${currentEnterpriseId}/organizations/${orgId}?include=details`)
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (cancelled) return
        if (json?.success) setOrg(json.data)
        else setError(json?.message || "Organization not found")
      })
      .catch(() => { if (!cancelled) setError("Failed to load organization") })
    return () => { cancelled = true }
  }, [currentEnterpriseId, orgId])

  const openOrgAdmin = () => {
    setOrganizationContext(orgId)
    router.push("/admin/org")
  }

  const breadcrumbs = [
    { label: "Organizations", href: "/admin/enterprise/organizations" },
    { label: org?.name || "Details" },
  ]

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Organization" breadcrumbs={breadcrumbs} />
        <EmptyState title={error} description="It may have been deleted, or it belongs to another enterprise.">
          <Link href="/admin/enterprise/organizations" className={buttonVariants({ variant: "outline" })}>Back to organizations</Link>
        </EmptyState>
      </div>
    )
  }

  const location = org ? [org.city, org.state, org.country].filter(Boolean).join(", ") : ""

  return (
    <div className="space-y-6">
      <PageHeader
        title={org?.name || "Organization"}
        description={org ? `${org.category ? `${statusLabel(org.category)} · ` : ""}${org.slug}` : "Loading…"}
        breadcrumbs={breadcrumbs}
        actions={
          <>
            <Button variant="outline" onClick={openOrgAdmin} disabled={!org}>
              <ExternalLink /> Open organization admin
            </Button>
            <PermissionGate permission={PERMISSIONS.ORG_EDIT}>
              <Link href={`/admin/enterprise/organizations/${orgId}/edit`} className={buttonVariants({ variant: "outline" })}>
                <Pencil /> Edit
              </Link>
            </PermissionGate>
          </>
        }
      />

      <KpiStrip
        isLoading={!org}
        items={[
          { label: "Events", value: num(org?.stats.events), caption: `${num(org?.stats.upcomingEvents)} upcoming` },
          { label: "Members", value: num(org?.stats.members), caption: "Active" },
          { label: "Registrations", value: num(org?.stats.registrations), caption: "All time" },
          ...(org?.stats.revenue === null ? [] : [{ label: "Revenue", value: inr(org?.stats.revenue), caption: "Completed payments" }]),
        ]}
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          {!org ? (
            <Card className="gap-0 p-4"><div className="space-y-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/3" /></div></Card>
          ) : (
            <Card className="gap-0 overflow-hidden p-0">
              <div className="flex items-center gap-3 border-b border-rule px-4 py-4">
                {org.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logo} alt="" className="size-10 shrink-0 rounded-md border object-contain" />
                ) : (
                  <Initial name={org.name} className="size-10 rounded-md" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{org.name}</span>
                    {org.isVerified && <BadgeCheck className="size-4 shrink-0 text-brand" aria-label="Verified" />}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">Created {fmtDate(org.createdAt, true)}</p>
                </div>
                <Pill tone={org.isActive ? "positive" : "neutral"}>{org.isActive ? "Active" : "Inactive"}</Pill>
              </div>
              <dl className="divide-y divide-rule">
                <Detail label="Description">{org.description || <span className="text-muted-foreground">No description</span>}</Detail>
                <Detail label="Email">{org.email}</Detail>
                <Detail label="Phone">{org.phone || <span className="text-muted-foreground">—</span>}</Detail>
                <Detail label="Website">
                  {org.website && /^https?:\/\//i.test(org.website) ? (
                    <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-brand underline-offset-4 hover:underline">{org.website}</a>
                  ) : org.website ? org.website : <span className="text-muted-foreground">—</span>}
                </Detail>
                <Detail label="Location">{location || <span className="text-muted-foreground">—</span>}</Detail>
                <Detail label="Event limit">{org.maxEvents ? num(org.maxEvents) : "No limit"}</Detail>
              </dl>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="events" className="mt-5 space-y-2">
          <DataTable
            columns={eventColumns}
            data={org?.events ?? []}
            isLoading={!org}
            emptyState={<TableEmpty title="No events yet" description="Events this organization creates will appear here." />}
          />
          {org && org.stats.events > org.events.length && (
            <p className="text-[13px] text-muted-foreground">Showing the latest {org.events.length} of {num(org.stats.events)} events.</p>
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-5">
          {!org ? (
            <Card className="gap-0 p-4"><Skeleton className="h-4 w-1/2" /></Card>
          ) : org.members.length === 0 ? (
            <EmptyState title="No members" description="People added to this organization will appear here." />
          ) : (
            <Card className="gap-0 overflow-hidden p-0">
              <ul className="divide-y divide-rule">
                {org.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <Initial name={m.name} />
                    <div className="min-w-0 flex-1"><PrimaryCell title={m.name} meta={m.email} /></div>
                    <Pill className="shrink-0">{getRoleLabel(m.role)}</Pill>
                  </li>
                ))}
              </ul>
              {org.stats.members > org.members.length && (
                <p className="border-t border-rule px-4 py-2.5 text-[13px] text-muted-foreground">
                  Showing {org.members.length} of {num(org.stats.members)} members.
                </p>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

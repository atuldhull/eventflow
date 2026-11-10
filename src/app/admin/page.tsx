"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useRBAC } from "@/hooks/useRBAC"
import { Building2, ChevronRight, ShieldCheck } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { getRoleLabel } from "@/lib/permissions"
import type { Role } from "@/lib/constants"

export default function AdminPage() {
  const router = useRouter()
  const {
    isLoading,
    isSuperAdmin,
    currentEnterpriseId,
    currentOrganizationId,
    accessibleEnterprises,
    accessibleOrganizations,
    setEnterpriseContext,
    setOrganizationContext,
  } = useRBAC()

  useEffect(() => {
    if (isLoading) return
    // Don't auto-redirect super admin — let them pick a workspace
    if (isSuperAdmin) return
    // only a workspace they can still open (a stale one would bounce back here)
    if (currentEnterpriseId && accessibleEnterprises.some((e) => e.id === currentEnterpriseId)) {
      router.replace("/admin/enterprise")
      return
    }
    if (currentOrganizationId && accessibleOrganizations.some((o) => o.id === currentOrganizationId)) {
      router.replace("/admin/org")
      return
    }
    if (accessibleEnterprises.length === 1) {
      setEnterpriseContext(accessibleEnterprises[0].id)
      router.replace("/admin/enterprise")
      return
    }
    if (accessibleOrganizations.length === 1 && accessibleEnterprises.length === 0) {
      setOrganizationContext(accessibleOrganizations[0].id)
      router.replace("/admin/org")
      return
    }
  }, [isLoading, isSuperAdmin, currentEnterpriseId, currentOrganizationId, accessibleEnterprises, accessibleOrganizations, router, setEnterpriseContext, setOrganizationContext])

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6" aria-busy="true" aria-label="Loading workspaces">
        <div className="space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-72" /></div>
        <div className="space-y-px overflow-hidden rounded-xl border">
          {[0, 1].map((i) => <Skeleton key={i} className="h-14 rounded-none" />)}
        </div>
      </div>
    )
  }

  if (accessibleEnterprises.length === 0 && accessibleOrganizations.length === 0) {
    return (
      <EmptyState
        variant="page"
        icon={Building2}
        title="No workspaces yet"
        description="Create your organization to start hosting events."
      >
        <Link href="/admin/create-org" className={buttonVariants()}>
          <Building2 /> Create organization
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Choose your workspace"
        description="Select an enterprise or organization to manage"
        actions={
          isSuperAdmin ? (
            <Link href="/super-admin" className={buttonVariants({ variant: "outline" })}>
              <ShieldCheck /> Go to Super Admin Panel
            </Link>
          ) : undefined
        }
      />

      {accessibleEnterprises.length > 0 && (
        <WorkspaceList
          label="Enterprises"
          items={accessibleEnterprises}
          onPick={(id) => {
            setEnterpriseContext(id)
            router.push("/admin/enterprise")
          }}
        />
      )}

      {accessibleOrganizations.length > 0 && (
        <WorkspaceList
          label="Organizations"
          items={accessibleOrganizations}
          onPick={(id) => {
            setOrganizationContext(id)
            router.push("/admin/org")
          }}
        />
      )}
    </div>
  )
}

function WorkspaceList({
  label,
  items,
  onPick,
}: {
  label: string
  items: { id: string; name: string; role?: string | null }[]
  onPick: (id: string) => void
}) {
  const headingId = `ws-${label.toLowerCase()}`
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 font-display text-[17px] font-semibold tracking-[-0.01em]">{label}</h2>
      <ul className="divide-y divide-rule overflow-hidden rounded-xl border">
        {items.map((ws) => (
          <li key={ws.id}>
            <button
              type="button"
              onClick={() => onPick(ws.id)}
              className="group flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-raised font-display text-base font-bold" aria-hidden>
                {ws.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{ws.name}</span>
              {ws.role && <Pill tone="neutral">{getRoleLabel(ws.role as Role)}</Pill>}
              <ChevronRight className="size-4 shrink-0 text-faint transition-colors group-hover:text-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

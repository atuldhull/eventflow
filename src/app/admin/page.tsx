"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useRBAC } from "@/hooks/useRBAC"
import { Building2, Users, Loader2, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getRoleLabel, getRoleColor } from "@/lib/permissions"
import { cn } from "@/lib/utils"
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
    if (currentEnterpriseId) {
      router.replace("/admin/enterprise")
      return
    }
    if (currentOrganizationId) {
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (accessibleEnterprises.length === 0 && accessibleOrganizations.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold">No workspaces found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          You don&apos;t have access to any enterprises or organizations. Contact your administrator to get access.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Choose your workspace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select an enterprise or organization to manage
        </p>
      </div>

      {isSuperAdmin && (
        <div className="flex justify-center">
          <Link href="/super-admin" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            <ShieldCheck className="h-4 w-4" />
            Go to Super Admin Panel
          </Link>
        </div>
      )}

      {accessibleEnterprises.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Enterprises</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {accessibleEnterprises.map((ent) => (
              <Card
                key={ent.id}
                className="p-4 cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setEnterpriseContext(ent.id)
                  router.push("/admin/enterprise")
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{ent.name}</p>
                    {ent.role && (
                      <Badge variant="secondary" className={`text-[10px] ${getRoleColor(ent.role as Role)}`}>
                        {getRoleLabel(ent.role as Role)}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {accessibleOrganizations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Organizations</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {accessibleOrganizations.map((org) => (
              <Card
                key={org.id}
                className="p-4 cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setOrganizationContext(org.id)
                  router.push("/admin/org")
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{org.name}</p>
                    {org.role && (
                      <Badge variant="secondary" className={`text-[10px] ${getRoleColor(org.role as Role)}`}>
                        {getRoleLabel(org.role as Role)}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

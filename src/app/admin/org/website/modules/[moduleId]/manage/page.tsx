"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Settings, SlidersHorizontal } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { ModuleAdminRenderer } from "@/lib/site-builder/module-renderer"
import { useRBAC } from "@/hooks/useRBAC"

/* eslint-disable @typescript-eslint/no-explicit-any -- module config is loosely typed by the API */

const breadcrumbs = (name?: string) => [
  { label: "Website", href: "/admin/org/website" },
  { label: "Modules", href: "/admin/org/website/modules" },
  ...(name ? [{ label: name }] : []),
]

export default function ModuleManagePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const [moduleId, setModuleId] = useState("")
  const [moduleName, setModuleName] = useState("")
  const [moduleConfig, setModuleConfig] = useState<Record<string, any>>({})
  const [hasAdminPanel, setHasAdminPanel] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { params.then((p) => setModuleId(p.moduleId)) }, [params])

  useEffect(() => {
    if (!currentOrganizationId || !moduleId) return
    async function load() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/modules/${moduleId}/config`)
        const json = await res.json()
        if (json.success) {
          setModuleName(json.module.name)
          setModuleConfig(json.config || {})
          setHasAdminPanel(json.module.hasAdminPanel)
        }
      } catch {} finally { setIsLoading(false) }
    }
    load()
  }, [currentOrganizationId, moduleId])

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader title="Module" breadcrumbs={breadcrumbs()} />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  }

  if (!hasAdminPanel) {
    return (
      <div className="space-y-6">
        <PageHeader title={moduleName || "Module"} breadcrumbs={breadcrumbs(moduleName || undefined)} />
        <EmptyState
          variant="page"
          icon={Settings}
          title="No content management needed"
          description="This module is configured in the Configuration page. It doesn't require content management."
        >
          <Link href={`/admin/org/website/modules/${moduleId}/config`} className={buttonVariants()}>Go to configuration</Link>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <PageHeader
          title={moduleName}
          breadcrumbs={breadcrumbs(moduleName)}
          actions={
            <Link href={`/admin/org/website/modules/${moduleId}/config`} className={buttonVariants({ variant: "outline" })}>
              <SlidersHorizontal />Configuration
            </Link>
          }
        />
        <Pill tone="positive" dot>Enabled</Pill>
      </div>

      {/* Module admin panel (the module's own UI) */}
      <ModuleAdminRenderer
        moduleId={moduleId}
        config={moduleConfig}
        orgSlug={String((org as any)?.slug || "")}
        placement="admin"
      />
    </div>
  )
}
/* eslint-enable @typescript-eslint/no-explicit-any */

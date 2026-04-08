"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ModuleAdminRenderer } from "@/lib/site-builder/module-renderer"
import { useRBAC } from "@/hooks/useRBAC"

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

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  if (!hasAdminPanel) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-4">
        <Settings className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-lg font-bold">No Content Management Needed</h2>
        <p className="text-sm text-muted-foreground">This module is configured in the Configuration page. It doesn't require content management.</p>
        <Link href={`/admin/org/website/modules/${moduleId}/config`}>
          <Button>Go to Configuration</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/org/website/modules"><Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">{moduleName}<Badge className="text-[10px] bg-green-500 text-white border-0">Enabled</Badge></h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Link href={`/admin/org/website/modules/${moduleId}/config`} className="text-xs text-muted-foreground hover:underline">Configuration</Link>
          </div>
        </div>
      </div>

      {/* Module Admin Panel */}
      <ModuleAdminRenderer
        moduleId={moduleId}
        config={moduleConfig}
        orgSlug={String((org as any)?.slug || "")}
        placement="admin"
      />
    </div>
  )
}

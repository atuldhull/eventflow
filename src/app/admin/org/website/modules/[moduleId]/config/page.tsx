"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronRight, Loader2, Puzzle, RotateCcw, Save } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"
import { FieldRenderer } from "@/components/website/editor/fields/FieldRenderer"

/* eslint-disable @typescript-eslint/no-explicit-any -- module schemas are loosely typed by the API */
interface ModuleData {
  moduleId: string; name: string; description: string; icon: string; category: string
  configSchema: any; defaultConfig: any; supportedPlacements: string[]; hasAdminPanel: boolean
  setupGuide: string | null; requiredPlan: string
}

const PLAN_LABEL: Record<string, string> = { FREE: "Free", STARTER: "Starter", PRO: "Pro", ENTERPRISE: "Enterprise" }
const planLabel = (plan: string | null | undefined) => PLAN_LABEL[plan ?? "FREE"] ?? plan ?? PLAN_LABEL.FREE

const breadcrumbs = (name?: string) => [
  { label: "Website", href: "/admin/org/website" },
  { label: "Modules", href: "/admin/org/website/modules" },
  ...(name ? [{ label: name }] : []),
]

export default function ModuleConfigPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { currentOrganizationId } = useRBAC()
  const [moduleId, setModuleId] = useState("")
  const [mod, setMod] = useState<ModuleData | null>(null)
  const [config, setConfig] = useState<Record<string, any>>({})
  const [placements, setPlacements] = useState<string[]>([])
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => { params.then((p) => setModuleId(p.moduleId)) }, [params])

  useEffect(() => {
    if (!currentOrganizationId || !moduleId) return
    async function load() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/modules/${moduleId}/config`)
        const json = await res.json()
        if (json.success) {
          setMod(json.module)
          setConfig(json.config || {})
          setPlacements(json.placements || [])
          setIsEnabled(json.isEnabled)
        }
      } catch {} finally { setIsLoading(false) }
    }
    load()
  }, [currentOrganizationId, moduleId])

  const handleSave = async () => {
    if (!currentOrganizationId || !moduleId) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/modules/${moduleId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, placements }),
      })
      const json = await res.json()
      if (json.success) toast.success("Configuration saved")
      else toast.error(json.message)
    } catch { toast.error("Failed to save") } finally { setIsSaving(false) }
  }

  const handleReset = () => {
    if (mod?.defaultConfig) { setConfig({ ...mod.defaultConfig }); toast.info("Reset to defaults") }
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader title="Module" breadcrumbs={breadcrumbs()} />
        <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    )
  }
  if (!mod) {
    return (
      <div className="space-y-6">
        <PageHeader title="Module" breadcrumbs={breadcrumbs()} />
        <EmptyState icon={Puzzle} title="Module not found" />
      </div>
    )
  }

  const schemaProps = mod.configSchema?.properties || {}
  const placementLabel = (p: string) => p.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <PageHeader
          title={mod.name}
          description={mod.category ? `${mod.category.charAt(0).toUpperCase()}${mod.category.slice(1).toLowerCase().replace(/_/g, " ")} module` : undefined}
          breadcrumbs={breadcrumbs(mod.name)}
          actions={
            <>
              <Button variant="outline" onClick={handleReset}><RotateCcw />Reset</Button>
              <Button onClick={handleSave} disabled={isSaving || !isEnabled} title={isEnabled ? undefined : "Enable this module first"}>
                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}Save
              </Button>
            </>
          }
        />
        {isEnabled ? (
          <Pill tone="positive" dot>Enabled</Pill>
        ) : (
          <Pill tone="neutral" dot>Not enabled</Pill>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Card className="gap-0 p-0">
            <h2 className="border-b border-rule px-5 py-3 text-[15px] font-semibold">Module settings</h2>
            <div className="space-y-5 p-5">
              {Object.entries(schemaProps).map(([key, fieldDef]: [string, any]) => (
                <FieldRenderer
                  key={key}
                  fieldKey={key}
                  fieldDef={{
                    type: fieldDef.type === "string" && fieldDef.enum ? "select" : fieldDef.type === "integer" ? "number" : fieldDef.type,
                    label: fieldDef.title || key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase()),
                    description: fieldDef.description,
                    options: fieldDef.enum,
                    min: fieldDef.minimum,
                    max: fieldDef.maximum,
                    default: fieldDef.default,
                  }}
                  value={config[key] ?? fieldDef.default}
                  onChange={(val) => setConfig({ ...config, [key]: val })}
                />
              ))}
              {Object.keys(schemaProps).length === 0 && <p className="text-[13px] text-muted-foreground">This module has no settings.</p>}
            </div>
          </Card>

          <Card className="gap-0 p-0">
            <div className="border-b border-rule px-5 py-3">
              <h2 className="text-[15px] font-semibold">Placements</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Where should this module appear on your website?</p>
            </div>
            <ul className="divide-y divide-rule">
              {mod.supportedPlacements.map((p) => (
                <li key={p}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-5 py-2 text-sm">
                    <Checkbox
                      checked={placements.includes(p)}
                      onCheckedChange={(checked) => setPlacements(checked ? [...placements, p] : placements.filter((x) => x !== p))}
                    />
                    {placementLabel(p)}
                  </label>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="gap-0 p-0">
            <div className="space-y-1.5 px-4 py-3.5">
              <h3 className="text-sm font-semibold">About</h3>
              <p className="text-[13px] text-muted-foreground">{mod.description}</p>
            </div>
            <dl className="divide-y divide-rule border-t border-rule text-[13px]">
              <div className="flex justify-between gap-3 px-4 py-2"><dt className="text-muted-foreground">Plan</dt><dd>{planLabel(mod.requiredPlan)}</dd></div>
              <div className="flex justify-between gap-3 px-4 py-2"><dt className="text-muted-foreground">Admin panel</dt><dd>{mod.hasAdminPanel ? "Yes" : "No"}</dd></div>
            </dl>
          </Card>

          {mod.hasAdminPanel && (
            <Link href={`/admin/org/website/modules/${moduleId}/manage`} className={buttonVariants({ variant: "outline", className: "w-full justify-between" })}>
              Manage content <ChevronRight />
            </Link>
          )}

          {mod.setupGuide && (
            <Card className="gap-0 p-0">
              <h3 className="border-b border-rule px-4 py-2.5 text-sm font-semibold">Setup guide</h3>
              <div className="px-4 py-3 text-[13px] whitespace-pre-wrap text-muted-foreground">{mod.setupGuide}</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
/* eslint-enable @typescript-eslint/no-explicit-any */

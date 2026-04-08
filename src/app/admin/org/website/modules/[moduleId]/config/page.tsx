"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Save, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"
import { FieldRenderer } from "@/components/website/editor/fields/FieldRenderer"

interface ModuleData {
  moduleId: string; name: string; description: string; icon: string; category: string
  configSchema: any; defaultConfig: any; supportedPlacements: string[]; hasAdminPanel: boolean
  setupGuide: string | null
}

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

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!mod) return <div className="text-center py-20 text-muted-foreground">Module not found</div>

  const schemaProps = mod.configSchema?.properties || {}

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/org/website/modules"><Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">{mod.name}<Badge className="text-[10px] bg-green-500 text-white border-0">Enabled</Badge></h1>
            <p className="text-sm text-muted-foreground">{mod.category}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleReset}><RotateCcw className="h-3.5 w-3.5" />Reset</Button>
          <Button size="sm" className="gap-1" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Config Form */}
        <div className="md:col-span-3 space-y-4">
          <Card className="p-5 space-y-5">
            <h2 className="font-semibold">Module Settings</h2>
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
          </Card>

          {/* Placements */}
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold">Placements</h2>
            <p className="text-xs text-muted-foreground">Where should this module appear on your website?</p>
            {mod.supportedPlacements.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={placements.includes(p)}
                  onChange={(e) => setPlacements(e.target.checked ? [...placements, p] : placements.filter((x) => x !== p))} />
                {p.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </label>
            ))}
          </Card>
        </div>

        {/* Info sidebar */}
        <div className="md:col-span-2 space-y-4">
          <Card className="p-4 space-y-3 text-sm">
            <h3 className="font-semibold">About</h3>
            <p className="text-muted-foreground text-xs">{mod.description}</p>
            <div className="text-xs space-y-1">
              <p><strong>Plan:</strong> {mod.category}</p>
              <p><strong>Admin Panel:</strong> {mod.hasAdminPanel ? "Yes" : "No"}</p>
            </div>
          </Card>

          {mod.hasAdminPanel && (
            <Link href={`/admin/org/website/modules/${moduleId}/manage`}>
              <Button variant="outline" className="w-full gap-1">Manage Content</Button>
            </Link>
          )}

          {mod.setupGuide && (
            <Card className="p-4 space-y-2">
              <h3 className="font-semibold text-sm">Setup Guide</h3>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{mod.setupGuide}</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

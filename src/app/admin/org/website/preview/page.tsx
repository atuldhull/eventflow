"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Monitor, Tablet, Smartphone, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionList } from "@/lib/site-builder/section-renderer"
import { DeviceFrame } from "@/components/website/DeviceFrame"
import { useRBAC } from "@/hooks/useRBAC"
import type { SectionConfig, SiteStyles } from "@/types/site-builder"

export default function WebsitePreviewPage() {
  const { currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const [sections, setSections] = useState<SectionConfig[]>([])
  const [styles, setStyles] = useState<SiteStyles | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop")

  useEffect(() => {
    if (!currentOrganizationId) return
    async function load() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/website`)
        const json = await res.json()
        if (json.success && json.exists) {
          setSections(json.siteConfig.sections || [])
          setStyles(json.siteConfig.styles)
        }
      } catch {} finally { setIsLoading(false) }
    }
    load()
  }, [currentOrganizationId])

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!styles) return <div className="h-screen flex items-center justify-center text-muted-foreground">No website configured</div>

  const previewContent = (
    <div style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, fontFamily: styles.fontBody }}>
      <SectionList sections={sections} siteStyles={styles} orgSlug={String((org as any)?.slug || "preview")} isPreview={true} />
    </div>
  )

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Floating controls */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-background/95 backdrop-blur rounded-full border shadow-lg px-4 py-2">
        <a href="/admin/org/website/editor"><Button variant="ghost" size="sm" className="gap-1 text-xs"><ArrowLeft className="h-3.5 w-3.5" />Editor</Button></a>
        <div className="h-4 w-px bg-border" />
        <span className="text-[10px] text-muted-foreground">Preview Mode</span>
        <div className="h-4 w-px bg-border" />
        {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([mode, Icon]) => (
          <button key={mode} onClick={() => setViewMode(mode)} className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      {/* Preview */}
      {viewMode === "desktop" ? (
        <div>{previewContent}</div>
      ) : (
        <div className="flex justify-center py-8">
          <DeviceFrame device={viewMode === "tablet" ? "tablet" : "phone"}>{previewContent}</DeviceFrame>
        </div>
      )}
    </div>
  )
}

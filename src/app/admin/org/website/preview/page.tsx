"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Globe, Monitor, Tablet, Smartphone } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionList } from "@/lib/site-builder/section-renderer"
import { DeviceFrame } from "@/components/website/DeviceFrame"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"
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

  if (isLoading) return <Skeleton className="h-[70vh] rounded-lg" aria-busy="true" />
  if (!styles) return <EmptyState variant="page" icon={Globe} title="No website configured" />

  const previewContent = (
    <div style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, fontFamily: styles.fontBody }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SectionList sections={sections} siteStyles={styles} orgSlug={String((org as any)?.slug || "preview")} isPreview={true} />
    </div>
  )

  return (
    <div className="-mx-4 -my-5 min-h-[70vh] bg-raised pb-24 sm:-mx-6 lg:-my-6 lg:rounded-[calc(var(--sheet-radius)-1px)]">
      {/* Preview (the tenant's own site) */}
      {viewMode === "desktop" ? (
        <div className="overflow-hidden lg:rounded-t-[calc(var(--sheet-radius)-1px)]">{previewContent}</div>
      ) : (
        <div className="flex justify-center px-4 py-8">
          <DeviceFrame device={viewMode === "tablet" ? "tablet" : "phone"}>{previewContent}</DeviceFrame>
        </div>
      )}

      {/* Floating controls */}
      <div className="fixed bottom-[calc(var(--bottombar-height)+env(safe-area-inset-bottom)+12px)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-(--shadow-float) lg:bottom-6">
        <a href="/admin/org/website/editor" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft />Editor
        </a>
        <span className="h-5 w-px bg-border" aria-hidden />
        <span className="px-2 text-xs text-muted-foreground max-sm:hidden">Preview</span>
        <div className="flex items-center" role="group" aria-label="Preview size">
          {([["desktop", Monitor, "Desktop"], ["tablet", Tablet, "Tablet"], ["mobile", Smartphone, "Phone"]] as const).map(([mode, Icon, label]) => (
            <Button
              key={mode}
              variant="ghost"
              size="icon-sm"
              onClick={() => setViewMode(mode)}
              aria-label={`${label} preview`}
              aria-pressed={viewMode === mode}
              className={cn(viewMode === mode ? "bg-accent text-foreground" : "text-muted-foreground")}
            >
              <Icon />
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

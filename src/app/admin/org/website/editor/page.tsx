"use client"

import { useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"
import { useEditorStore } from "@/stores/useEditorStore"
import { EditorTopBar } from "@/components/website/editor/EditorTopBar"
import { SectionListPanel } from "@/components/website/editor/SectionListPanel"
import { SectionEditor } from "@/components/website/editor/SectionEditor"
import { EditorPreview } from "@/components/website/editor/EditorPreview"

export default function WebsiteEditorPage() {
  const router = useRouter()
  const { currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const { siteConfig, isLoaded, isDirty, leftPanelView, init, setSaving, markSaved } = useEditorStore()
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load site config
  useEffect(() => {
    if (!currentOrganizationId) return
    async function load() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/website`)
        const json = await res.json()
        if (json.success && json.exists) {
          const sc = json.siteConfig
          init({
            id: sc.id,
            siteName: sc.siteName,
            tagline: sc.tagline,
            sections: sc.sections || [],
            styles: sc.styles || {},
            enabledFeatures: sc.enabledFeatures || [],
            navigation: sc.navigation || [],
            footer: sc.footer,
            isPublished: sc.isPublished,
            customCss: sc.customCss,
            seoTitle: sc.seoTitle,
            seoDescription: sc.seoDescription,
            templateId: sc.templateId,
          }, currentOrganizationId!, String((org as any)?.slug || ""))
        } else {
          // No site config — redirect to website setup
          router.replace("/admin/org/website")
        }
      } catch {
        toast.error("Failed to load website data")
      }
    }
    load()
  }, [currentOrganizationId])

  // Auto-save every 60 seconds
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      const state = useEditorStore.getState()
      if (state.isDirty && !state.isSaving) {
        handleSave(true)
      }
    }, 60000)
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current) }
  }, [])

  // Warn on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = "" }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  const handleSave = useCallback(async (silent = false) => {
    const state = useEditorStore.getState()
    if (!state.siteConfig || !state.orgId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/org/${state.orgId}/website`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: state.siteConfig.siteName,
          sections: state.siteConfig.sections,
          styles: state.siteConfig.styles,
          enabledFeatures: state.siteConfig.enabledFeatures,
          navigation: state.siteConfig.navigation,
          footer: state.siteConfig.footer,
          customCss: state.siteConfig.customCss,
          seoTitle: state.siteConfig.seoTitle,
          seoDescription: state.siteConfig.seoDescription,
        }),
      })
      const json = await res.json()
      if (json.success) {
        markSaved()
        if (!silent) toast.success("Saved!")
      } else {
        toast.error(json.message || "Failed to save")
      }
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }, [])

  const handlePublish = useCallback(async () => {
    await handleSave(true)
    const state = useEditorStore.getState()
    if (!state.orgId) return
    try {
      const res = await fetch(`/api/admin/org/${state.orgId}/website/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: true }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Website published!")
        // Update local state
        useEditorStore.setState((s) => ({
          siteConfig: s.siteConfig ? { ...s.siteConfig, isPublished: true } : null,
        }))
      } else {
        toast.error(json.message || "Failed to publish")
      }
    } catch {
      toast.error("Failed to publish")
    }
  }, [handleSave])

  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <EditorTopBar onSave={() => handleSave(false)} onPublish={handlePublish} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-80 border-r bg-background flex flex-col overflow-hidden shrink-0">
          {leftPanelView === "section-editor" ? <SectionEditor /> : <SectionListPanel />}
        </div>

        {/* Right Panel — Preview */}
        <div className="flex-1 overflow-hidden">
          <EditorPreview />
        </div>
      </div>
    </div>
  )
}

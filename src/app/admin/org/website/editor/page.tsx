"use client"

import { useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"
import { useEditorStore } from "@/stores/useEditorStore"
import { FileText, Palette, Navigation, Settings, Search, FileStack } from "lucide-react"
import { EditorTopBar } from "@/components/website/editor/EditorTopBar"
import { SectionListPanel } from "@/components/website/editor/SectionListPanel"
import { SectionEditor } from "@/components/website/editor/SectionEditor"
import { EditorPreview } from "@/components/website/editor/EditorPreview"
import { StylesPanel } from "@/components/website/editor/StylesPanel"
import { NavigationPanel } from "@/components/website/editor/NavigationPanel"
import { SettingsPanel } from "@/components/website/editor/SettingsPanel"
import { SEOPanel } from "@/components/website/editor/SEOPanel"
import { PagesPanel } from "@/components/website/editor/PagesPanel"
import type { PanelView } from "@/stores/useEditorStore"

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
            siteDescription: sc.siteDescription,
            favicon: sc.favicon,
            ogImage: sc.ogImage,
            sections: sc.sections || [],
            styles: sc.styles || {},
            enabledFeatures: sc.enabledFeatures || [],
            navigation: sc.navigation || [],
            footer: sc.footer,
            isPublished: sc.isPublished,
            customCss: sc.customCss,
            seoTitle: sc.seoTitle,
            seoDescription: sc.seoDescription,
            seoKeywords: sc.seoKeywords || [],
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
          seoKeywords: state.siteConfig.seoKeywords,
          tagline: state.siteConfig.tagline,
          siteDescription: state.siteConfig.siteDescription,
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

  // The editor fills the shell's sheet edge to edge: viewport minus the top bar
  // (and, on phones/tablets, the bottom tab bar).
  const frameClass =
    "-mx-4 -my-5 sm:-mx-6 lg:-my-6 flex flex-col overflow-hidden bg-background " +
    "h-[calc(100dvh-3rem-env(safe-area-inset-top)-var(--bottombar-height)-env(safe-area-inset-bottom)-1rem)] " +
    "lg:h-[calc(100dvh-3rem-var(--sheet-inset)-2px)] lg:rounded-[calc(var(--sheet-radius)-1px)]"

  if (!isLoaded) {
    return (
      <div className={`${frameClass} items-center justify-center`} aria-busy="true">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading editor" />
      </div>
    )
  }

  return (
    <div className={frameClass}>
      <EditorTopBar onSave={() => handleSave(false)} onPublish={handlePublish} />

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Left Panel */}
        <div className="flex h-[55%] w-full shrink-0 flex-col overflow-hidden border-b bg-background md:h-auto md:w-80 md:border-r md:border-b-0">
          {/* Panel tabs */}
          <div className="flex shrink-0 items-center border-b px-1" role="tablist" aria-label="Editor panels">
            {([
              { view: "sections" as PanelView, icon: <FileText className="size-4" />, label: "Sections" },
              { view: "styles" as PanelView, icon: <Palette className="size-4" />, label: "Styles" },
              { view: "navigation" as PanelView, icon: <Navigation className="size-4" />, label: "Navigation" },
              { view: "settings" as PanelView, icon: <Settings className="size-4" />, label: "Settings" },
              { view: "seo" as PanelView, icon: <Search className="size-4" />, label: "SEO" },
              { view: "pages" as PanelView, icon: <FileStack className="size-4" />, label: "Pages" },
            ]).map((tab) => {
              const active = leftPanelView === tab.view || (tab.view === "sections" && leftPanelView === "section-editor")
              return (
                <button key={tab.view} onClick={() => useEditorStore.getState().setLeftPanelView(tab.view)}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={tab.label}
                  title={tab.label}
                  className={`relative flex min-h-11 flex-1 items-center justify-center transition-colors after:absolute after:inset-x-1.5 after:bottom-[-1px] after:h-0.5 after:rounded-full ${
                    active ? "text-foreground after:bg-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {tab.icon}
                </button>
              )
            })}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {(leftPanelView === "sections" || leftPanelView === "section-editor") && (
              leftPanelView === "section-editor" ? <SectionEditor /> : <SectionListPanel />
            )}
            {leftPanelView === "styles" && <StylesPanel />}
            {leftPanelView === "navigation" && <NavigationPanel />}
            {leftPanelView === "settings" && <SettingsPanel />}
            {leftPanelView === "seo" && <SEOPanel />}
            {leftPanelView === "pages" && <PagesPanel />}
          </div>
        </div>

        {/* Right Panel — Preview */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <EditorPreview />
        </div>
      </div>
    </div>
  )
}

"use client"

import { useMemo, useCallback } from "react"
import { SectionList } from "@/lib/site-builder/section-renderer"
import { DeviceFrame } from "@/components/website/DeviceFrame"
import { useEditorStore } from "@/stores/useEditorStore"
import type { SiteStyles } from "@/types/site-builder"

export function EditorPreview() {
  const { siteConfig, selectedSectionId, previewMode, selectSection } = useEditorStore()

  const sections = useMemo(() =>
    siteConfig?.sections || []
  , [siteConfig?.sections])

  const styles: SiteStyles = useMemo(() =>
    siteConfig?.styles || {
      primaryColor: "#6366f1", secondaryColor: "#1e293b", backgroundColor: "#ffffff",
      textColor: "#1e293b", fontHeading: "'Inter', sans-serif", fontBody: "'Inter', sans-serif",
      borderRadius: "8px", buttonStyle: "rounded" as const, navStyle: "solid" as const, footerStyle: "dark" as const,
    }
  , [siteConfig?.styles])

  const cssVars = useMemo(() => ({
    "--site-primary": styles.primaryColor,
    "--site-secondary": styles.secondaryColor,
    "--site-accent": styles.accentColor || styles.primaryColor,
    "--site-bg": styles.backgroundColor,
    "--site-text": styles.textColor,
    "--site-radius": styles.borderRadius,
  } as React.CSSProperties), [styles])

  const handleSectionClick = useCallback((sectionId: string) => {
    selectSection(sectionId)
  }, [selectSection])

  const previewContent = (
    <div
      style={{ ...cssVars, backgroundColor: styles.backgroundColor, color: styles.textColor, fontFamily: styles.fontBody }}
      className="min-h-[400px]"
    >
      {sections.filter((s) => s.enabled).sort((a, b) => a.order - b.order).map((section) => (
        <div
          key={section.id}
          className={`group relative cursor-pointer transition-shadow ${
            selectedSectionId === section.id ? "ring-2 ring-brand ring-inset" : "hover:ring-1 hover:ring-brand/50 hover:ring-inset"
          }`}
          onClick={() => handleSectionClick(section.id)}
        >
          {/* Section label on hover */}
          <div className={`absolute top-0 left-0 z-10 rounded-br-[4px] bg-brand px-2 py-0.5 font-sans text-[11px] font-medium text-brand-foreground transition-opacity ${
            selectedSectionId === section.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}>
            {section.type.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </div>
          <SectionList
            sections={[section]}
            siteStyles={styles}
            orgSlug={siteConfig?.siteName?.toLowerCase().replace(/\s+/g, "-") || "preview"}
            isPreview={true}
          />
        </div>
      ))}
      {sections.filter((s) => s.enabled).length === 0 && (
        <div className="flex min-h-[400px] items-center justify-center p-6 text-center font-sans text-sm text-muted-foreground">
          No visible sections. Add or enable sections from the left panel.
        </div>
      )}
    </div>
  )

  if (previewMode === "desktop") {
    return (
      <div className="h-full overflow-y-auto bg-raised p-3 sm:p-4">
        <div className="overflow-hidden rounded-lg border bg-background">
          {/* Mini browser bar */}
          <div className="flex items-center gap-2 border-b bg-raised px-3 py-1.5">
            <div className="flex gap-1" aria-hidden>
              <div className="size-2 rounded-full bg-input" />
              <div className="size-2 rounded-full bg-input" />
              <div className="size-2 rounded-full bg-input" />
            </div>
            <div className="mx-3 min-w-0 flex-1">
              <div className="mx-auto max-w-sm truncate rounded-[4px] border bg-background px-2 py-0.5 text-center font-mono text-[11px] text-muted-foreground">
                {siteConfig?.siteName?.toLowerCase().replace(/\s+/g, "-") || "org"}.eventflow.com
              </div>
            </div>
          </div>
          {previewContent}
        </div>
      </div>
    )
  }

  // Tablet / Mobile
  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-raised p-4">
      <div
        key={previewMode}
        style={{ maxWidth: previewMode === "tablet" ? 768 : 375 }}
        className="w-full"
      >
        <DeviceFrame device={previewMode === "tablet" ? "tablet" : "phone"}>
          {previewContent}
        </DeviceFrame>
      </div>
    </div>
  )
}

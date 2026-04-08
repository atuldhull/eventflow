"use client"

import { useMemo, useCallback } from "react"
import { motion } from "framer-motion"
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
          className={`relative group cursor-pointer transition-all ${
            selectedSectionId === section.id ? "ring-2 ring-primary ring-offset-2" : "hover:ring-1 hover:ring-primary/30"
          }`}
          onClick={() => handleSectionClick(section.id)}
        >
          {/* Section label on hover */}
          <div className={`absolute top-0 left-0 z-10 px-2 py-0.5 text-[10px] font-medium bg-primary text-primary-foreground rounded-br-md transition-opacity ${
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
        <div className="flex items-center justify-center min-h-[400px] text-muted-foreground text-sm">
          No visible sections. Add or enable sections from the left panel.
        </div>
      )}
    </div>
  )

  if (previewMode === "desktop") {
    return (
      <div className="h-full overflow-y-auto bg-muted/30 p-4">
        <div className="rounded-xl border shadow-lg bg-background overflow-hidden">
          {/* Mini browser bar */}
          <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5">
            <div className="flex gap-1">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <div className="h-2 w-2 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 mx-3">
              <div className="rounded bg-background border px-2 py-0.5 text-[10px] text-muted-foreground max-w-sm mx-auto text-center">
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
    <div className="h-full overflow-y-auto bg-muted/30 flex items-start justify-center p-4">
      <motion.div
        key={previewMode}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        style={{ maxWidth: previewMode === "tablet" ? 768 : 375 }}
        className="w-full"
      >
        <DeviceFrame device={previewMode === "tablet" ? "tablet" : "phone"}>
          {previewContent}
        </DeviceFrame>
      </motion.div>
    </div>
  )
}

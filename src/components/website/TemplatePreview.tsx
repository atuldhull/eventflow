"use client"

import { useMemo } from "react"
import { SectionList } from "@/lib/site-builder/section-renderer"
import { DeviceFrame } from "./DeviceFrame"
import type { SectionConfig, SiteStyles } from "@/types/site-builder"

interface TemplatePreviewProps {
  sections: SectionConfig[]
  styles: SiteStyles
  viewMode?: "desktop" | "tablet" | "mobile"
  isInteractive?: boolean
  orgSlug?: string
  className?: string
}

export function TemplatePreview({
  sections,
  styles,
  viewMode = "desktop",
  isInteractive = false,
  orgSlug = "preview",
  className,
}: TemplatePreviewProps) {
  const cssVars = useMemo(() => ({
    "--site-primary": styles.primaryColor,
    "--site-secondary": styles.secondaryColor,
    "--site-accent": styles.accentColor || styles.primaryColor,
    "--site-bg": styles.backgroundColor,
    "--site-text": styles.textColor,
    "--site-radius": styles.borderRadius,
    "--site-font-heading": styles.fontHeading,
    "--site-font-body": styles.fontBody,
  } as React.CSSProperties), [styles])

  const content = (
    <div
      className={`relative ${!isInteractive ? "pointer-events-none select-none" : ""}`}
      style={{
        ...cssVars,
        backgroundColor: styles.backgroundColor,
        color: styles.textColor,
        fontFamily: styles.fontBody,
      }}
    >
      {!isInteractive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="text-4xl font-bold opacity-[0.03] rotate-[-15deg]">PREVIEW</span>
        </div>
      )}
      <SectionList
        sections={sections}
        siteStyles={styles}
        orgSlug={orgSlug}
        isPreview={true}
      />
    </div>
  )

  if (viewMode === "desktop") {
    return (
      <DeviceFrame device="desktop" url={`${orgSlug}.eventflow.com`} className={className}>
        {content}
      </DeviceFrame>
    )
  }

  return (
    <DeviceFrame device={viewMode === "mobile" ? "phone" : "tablet"} className={className}>
      {content}
    </DeviceFrame>
  )
}

export default TemplatePreview

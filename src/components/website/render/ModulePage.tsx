"use client"

import Link from "next/link"
import { ModuleRenderer } from "@/lib/site-builder/module-renderer"
import { getModuleDefinition } from "@/lib/site-builder/modules"
import type { SiteStyles } from "@/types/site-builder"

interface ModulePageProps {
  moduleId: string
  moduleConfig: Record<string, any>
  orgSlug: string
  styles: SiteStyles
  siteName: string
}

export function ModulePage({ moduleId, moduleConfig, orgSlug, styles, siteName }: ModulePageProps) {
  const moduleDef = getModuleDefinition(moduleId)
  const title = moduleDef?.name || moduleId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm mb-6" style={{ color: `${styles.textColor}80` }}>
        <Link href="/" className="hover:underline">{siteName}</Link>
        <span>/</span>
        <span style={{ color: styles.textColor }}>{title}</span>
      </nav>

      {/* Module title */}
      <h1 className="text-2xl sm:text-3xl font-bold mb-8" style={{ fontFamily: styles.fontHeading }}>{title}</h1>

      {/* Module content */}
      <ModuleRenderer
        moduleId={moduleId}
        config={moduleConfig}
        orgSlug={orgSlug}
        placement="standalone-page"
        isPreview={false}
      />
    </div>
  )
}

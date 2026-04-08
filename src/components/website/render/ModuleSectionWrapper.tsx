"use client"

import { ModuleRenderer } from "@/lib/site-builder/module-renderer"
import type { SiteStyles } from "@/types/site-builder"

interface ModuleSectionWrapperProps {
  config: Record<string, any>
  content: Record<string, any>
  siteStyles: SiteStyles
  orgSlug: string
  isPreview: boolean
}

export function ModuleSectionWrapper({ config, content, siteStyles, orgSlug, isPreview }: ModuleSectionWrapperProps) {
  const moduleId = config.moduleId
  if (!moduleId) return null

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {content.title && (
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2" style={{ fontFamily: siteStyles.fontHeading }}>
            {content.title}
          </h2>
        )}
        {content.subtitle && (
          <p className="text-center text-sm opacity-60 mb-8 max-w-2xl mx-auto">{content.subtitle}</p>
        )}
        <ModuleRenderer
          moduleId={moduleId}
          config={config}
          orgSlug={orgSlug}
          placement="page-section"
          isPreview={isPreview}
        />
      </div>
    </section>
  )
}

export default ModuleSectionWrapper

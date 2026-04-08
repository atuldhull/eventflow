import { headers } from "next/headers"
import type { Metadata } from "next"
import { SectionList } from "@/lib/site-builder/section-renderer"
import { getModuleIdFromSlug } from "@/lib/site-builder/styles"
import { getSiteData, getPageData } from "@/lib/site-builder/fetch-site"
import { SiteNotFound } from "@/components/website/render/SiteNotFound"
import { ModulePage } from "@/components/website/render/ModulePage"
import type { SectionConfig, SiteStyles } from "@/types/site-builder"

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params
  const headerList = await headers()
  const orgSlug = headerList.get("x-tenant-slug") || "preview"
  const data = await getSiteData(orgSlug)
  if (!data) return { title: "Not Found" }

  const firstSlug = slug[0]

  // Events pages
  if (firstSlug === "events") {
    if (slug.length === 1) return { title: "Events" }
    return { title: slug[1].replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) }
  }

  // Custom pages
  const page = await getPageData(orgSlug, firstSlug)
  if (page) return { title: page.seoTitle || page.title }

  // Module pages
  const moduleId = getModuleIdFromSlug(firstSlug)
  if (moduleId) return { title: firstSlug.charAt(0).toUpperCase() + firstSlug.slice(1) }

  return { title: "Not Found" }
}

export default async function SiteCatchAllPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const headerList = await headers()
  const orgSlug = headerList.get("x-tenant-slug") || "preview"
  const data = await getSiteData(orgSlug)

  if (!data) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Website not found</div>
  }

  const site = data.site
  const styles = site.styles as SiteStyles
  const firstSlug = slug[0]

  // ── Events listing ──
  if (firstSlug === "events" && slug.length === 1) {
    // Render events grid section with full page
    const eventsSection: SectionConfig = {
      id: "page_events",
      type: "events-grid",
      enabled: true,
      order: 0,
      config: { columns: "3", maxEvents: 12, cardVariant: "default" },
      content: { heading: "Events" },
    }
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SectionList sections={[eventsSection]} siteStyles={styles} orgSlug={orgSlug} isPreview={false} />
      </div>
    )
  }

  // ── Event detail ──
  if (firstSlug === "events" && slug.length >= 2) {
    const eventSlug = slug[1]
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: styles.fontHeading }}>
          {eventSlug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
        </h1>
        <p className="text-sm opacity-60 mb-8">Event details are loaded dynamically from the events system.</p>
        {/* In production, this would fetch event data and render the full event detail */}
        <a href={`/events/${eventSlug}`} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-white" style={{ backgroundColor: styles.primaryColor, borderRadius: styles.borderRadius }}>
          View Full Event Page
        </a>
      </div>
    )
  }

  // ── Custom page (SitePage) ──
  const page = await getPageData(orgSlug, firstSlug)
  if (page) {
    const pageSections = (page.sections || []) as SectionConfig[]
    return (
      <div>
        {pageSections.length > 0 ? (
          <SectionList sections={pageSections} siteStyles={styles} orgSlug={orgSlug} isPreview={false} />
        ) : (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: styles.fontHeading }}>{page.title}</h1>
            <p className="opacity-60 text-sm">This page has no content yet.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Feature module standalone page ──
  const moduleId = getModuleIdFromSlug(firstSlug)
  if (moduleId) {
    const enabledFeatures = (site.enabledFeatures || []) as any[]
    const featureConfig = enabledFeatures.find((f: any) => f.moduleId === moduleId && f.enabled)
    if (featureConfig) {
      return <ModulePage moduleId={moduleId} moduleConfig={featureConfig.config || {}} orgSlug={orgSlug} styles={styles} siteName={site.siteName} />
    }
  }

  // ── 404 ──
  return <SiteNotFound siteName={site.siteName} styles={styles} />
}

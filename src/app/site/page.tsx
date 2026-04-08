import { headers } from "next/headers"
import { SectionList } from "@/lib/site-builder/section-renderer"
import { getSiteData } from "@/lib/site-builder/fetch-site"
import type { SectionConfig, SiteStyles } from "@/types/site-builder"

export default async function SiteHomePage() {
  const headerList = await headers()
  const orgSlug = headerList.get("x-tenant-slug") || "preview"
  const data = await getSiteData(orgSlug)

  if (!data) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Website not found</div>
  }

  const sections = (data.site.sections || []) as SectionConfig[]
  const styles = data.site.styles as SiteStyles

  return (
    <>
      <SectionList sections={sections} siteStyles={styles} orgSlug={orgSlug} isPreview={false} />

      {/* Structured Data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: data.organization.name,
        url: `https://${orgSlug}.eventflow.com`,
        description: data.site.siteDescription,
        ...(data.organization.logo ? { logo: data.organization.logo } : {}),
      }) }} />
    </>
  )
}

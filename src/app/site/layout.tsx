import { headers } from "next/headers"
import type { Metadata } from "next"
import { generateCSSVariables, getGoogleFontsUrl, sanitizeCustomCss } from "@/lib/site-builder/styles"
import { SiteNavbar } from "@/components/website/render/SiteNavbar"
import { SiteFooter } from "@/components/website/render/SiteFooter"
import type { SiteStyles, NavItem, FooterConfig } from "@/types/site-builder"

async function getSiteData(orgSlug: string) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  try {
    const res = await fetch(`${baseUrl}/api/site/${orgSlug}`, { next: { revalidate: 120 } })
    if (!res.ok) return null
    const json = await res.json()
    return json.exists ? json : null
  } catch { return null }
}

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers()
  const orgSlug = headerList.get("x-tenant-slug") || "preview"
  const data = await getSiteData(orgSlug)
  if (!data) return { title: "Website" }

  const site = data.site
  return {
    title: { default: site.seoTitle || site.siteName, template: `%s | ${site.siteName}` },
    description: site.seoDescription || site.siteDescription,
    keywords: site.seoKeywords,
    openGraph: {
      title: site.seoTitle || site.siteName,
      description: site.seoDescription,
      images: site.ogImage ? [site.ogImage] : [],
      siteName: site.siteName,
    },
    icons: site.favicon ? { icon: site.favicon } : undefined,
    robots: { index: true, follow: true },
  }
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers()
  const orgSlug = headerList.get("x-tenant-slug") || "preview"
  const data = await getSiteData(orgSlug)

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Website not found</div>
  }

  const site = data.site
  const org = data.organization
  const styles = site.styles as SiteStyles
  const navigation = (site.navigation || []) as NavItem[]
  const footer = site.footer as FooterConfig | null
  const cssVars = generateCSSVariables(styles)
  const fontsUrl = getGoogleFontsUrl(styles)

  return (
    <>
      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href={fontsUrl} rel="stylesheet" />

      {/* CSS Variables */}
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />

      {/* Custom CSS */}
      {site.customCss && <style dangerouslySetInnerHTML={{ __html: sanitizeCustomCss(site.customCss) }} />}

      <div style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, fontFamily: styles.fontBody, minHeight: "100vh" }}>
        <SiteNavbar siteName={site.siteName} logo={org.logo} navigation={navigation} styles={styles} />
        <main>{children}</main>
        <SiteFooter footer={footer} styles={styles} orgName={org.name} />
      </div>
    </>
  )
}

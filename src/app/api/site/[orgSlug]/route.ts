import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET — Fetch published website data (public, no auth)
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, slug: true, logo: true, description: true },
  })

  if (!org) {
    return NextResponse.json({ success: true, exists: false }, { headers: { "Cache-Control": "no-store" } })
  }

  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: org.id },
    include: { template: { select: { name: true, slug: true, category: true } } },
  })

  if (!siteConfig || !siteConfig.isPublished) {
    return NextResponse.json({ success: true, exists: false }, { headers: { "Cache-Control": "no-store" } })
  }

  const pages = await prisma.sitePage.findMany({
    where: { siteConfigId: siteConfig.id, isPublished: true },
    orderBy: { navOrder: "asc" },
    select: { title: true, slug: true, navIcon: true, showInNav: true, navOrder: true },
  })

  return NextResponse.json({
    success: true,
    exists: true,
    site: {
      id: siteConfig.id,
      siteName: siteConfig.siteName,
      tagline: siteConfig.tagline,
      siteDescription: siteConfig.siteDescription,
      favicon: siteConfig.favicon,
      ogImage: siteConfig.ogImage,
      sections: siteConfig.sections,
      styles: siteConfig.styles,
      navigation: siteConfig.navigation,
      footer: siteConfig.footer,
      enabledFeatures: siteConfig.enabledFeatures,
      content: siteConfig.content,
      customCss: siteConfig.customCss,
      seoTitle: siteConfig.seoTitle,
      seoDescription: siteConfig.seoDescription,
      seoKeywords: siteConfig.seoKeywords,
      template: siteConfig.template ? { name: siteConfig.template.name, slug: siteConfig.template.slug, category: siteConfig.template.category } : null,
      pages,
    },
    organization: { id: org.id, name: org.name, slug: org.slug, logo: org.logo, description: org.description },
  }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=15" } })
}

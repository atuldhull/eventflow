import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — Content overview statistics
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: orgId },
    select: { id: true, sections: true, enabledFeatures: true, footer: true, seoTitle: true, seoDescription: true, favicon: true },
  })

  if (!siteConfig) return NextResponse.json({ success: true, exists: false })

  const sections = (siteConfig.sections as any[]) || []
  const enabledFeatures = (siteConfig.enabledFeatures as any[]) || []
  const enabledCount = enabledFeatures.filter((f: any) => f.enabled).length

  const [pageCount, mediaStats, moduleDataCounts] = await Promise.all([
    prisma.sitePage.count({ where: { siteConfigId: siteConfig.id } }),
    prisma.siteMedia.aggregate({ where: { siteConfigId: siteConfig.id }, _count: { id: true }, _sum: { fileSize: true } }),
    prisma.featureModuleData.groupBy({
      by: ["moduleId", "dataType"],
      where: { organizationId: orgId },
      _count: { id: true },
    }),
  ])

  // Build completeness checklist
  const completeness: { key: string; label: string; done: boolean; action?: string }[] = [
    { key: "hero", label: "Hero section configured", done: sections.some((s: any) => s.type?.startsWith("hero-") && s.enabled) },
    { key: "about", label: "About section has content", done: sections.some((s: any) => (s.type === "about-simple" || s.type === "mission-values") && s.enabled) },
    { key: "events", label: "Events section added", done: sections.some((s: any) => s.type?.startsWith("events-") && s.enabled), action: "/admin/org/website/editor" },
    { key: "seo", label: "SEO title and description set", done: !!(siteConfig.seoTitle && siteConfig.seoDescription) },
    { key: "favicon", label: "Custom favicon uploaded", done: !!siteConfig.favicon, action: "/admin/org/website/editor" },
    { key: "footer", label: "Footer configured", done: !!(siteConfig.footer && (siteConfig.footer as any).copyright) },
    { key: "contact", label: "Contact section added", done: sections.some((s: any) => s.type === "contact-form" && s.enabled) },
  ]

  const score = Math.round((completeness.filter((c) => c.done).length / completeness.length) * 100)

  // Module content counts
  const moduleContent = moduleDataCounts.reduce<Record<string, number>>((acc, d) => {
    acc[d.moduleId] = (acc[d.moduleId] || 0) + d._count.id
    return acc
  }, {})

  return NextResponse.json({
    success: true,
    exists: true,
    sections: { homepage: sections.filter((s: any) => s.enabled).length, total: sections.length },
    pages: { total: pageCount + 1 },
    modules: { enabled: enabledCount, total: 12 },
    media: { total: mediaStats._count.id, totalSizeMB: Math.round((mediaStats._sum.fileSize || 0) / (1024 * 1024) * 10) / 10 },
    moduleContent,
    completeness: { score, items: completeness },
  })
}

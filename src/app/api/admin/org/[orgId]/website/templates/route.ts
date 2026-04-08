import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — List available templates for the marketplace
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const templates = await prisma.siteTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { installCount: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      longDescription: true,
      category: true,
      thumbnail: true,
      previewImages: true,
      tags: true,
      isPremium: true,
      isFeatured: true,
      requiredPlan: true,
      installCount: true,
      rating: true,
      ratingCount: true,
      supportedFeatures: true,
      defaultSections: true,
      defaultStyles: true,
      version: true,
      author: true,
    },
  })

  // Get org's current site config to determine current template
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: orgId },
    select: { templateId: true },
  })

  const data = templates.map((t) => ({
    ...t,
    isCurrentTemplate: siteConfig?.templateId === t.id,
  }))

  return NextResponse.json({ success: true, data })
}

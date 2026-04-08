import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// POST — Publish or unpublish the website
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const siteConfig = await prisma.siteConfig.findUnique({ where: { organizationId: orgId } })
  if (!siteConfig) return NextResponse.json({ success: false, message: "No website exists" }, { status: 404 })

  const body = await req.json()
  const { publish } = body as { publish: boolean }

  if (publish) {
    // Validate: at least 1 enabled section
    const sections = (siteConfig.sections as any[]) || []
    const enabledSections = sections.filter((s: any) => s.enabled)
    if (enabledSections.length === 0) {
      return NextResponse.json({ success: false, message: "Enable at least one section before publishing" }, { status: 400 })
    }
    if (!siteConfig.siteName) {
      return NextResponse.json({ success: false, message: "Set a site name before publishing" }, { status: 400 })
    }
  }

  const updated = await prisma.siteConfig.update({
    where: { organizationId: orgId },
    data: {
      isPublished: publish,
      ...(publish && !siteConfig.publishedAt ? { publishedAt: new Date() } : {}),
      lastEditedAt: new Date(),
      lastEditedBy: session.user.id,
    },
  })

  return NextResponse.json({ success: true, siteConfig: updated })
}

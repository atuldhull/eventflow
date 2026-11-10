import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// POST — Bulk operations on media
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await req.json()
  const { action, mediaIds, folder, tags } = body as { action: string; mediaIds: string[]; folder?: string; tags?: string[] }

  if (!action || !Array.isArray(mediaIds) || !mediaIds.length || !mediaIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ success: false, message: "action and mediaIds required" }, { status: 400 })
  }

  // Every query below is scoped to this org's site: ids belonging to another org's media
  // simply don't match and are skipped.
  const siteConfig = await prisma.siteConfig.findUnique({ where: { organizationId: orgId }, select: { id: true } })
  if (!siteConfig) return NextResponse.json({ success: false, message: "No website exists" }, { status: 404 })
  const scope = { id: { in: mediaIds }, siteConfigId: siteConfig.id }

  let successCount = 0
  let failedCount = 0

  if (action === "move" && folder) {
    const result = await prisma.siteMedia.updateMany({ where: scope, data: { folder } })
    successCount = result.count
  } else if (action === "tag" && tags?.length) {
    const items = await prisma.siteMedia.findMany({ where: scope, select: { id: true, tags: true } })
    for (const media of items) {
      try {
        const newTags = [...new Set([...media.tags, ...tags])]
        const result = await prisma.siteMedia.updateMany({ where: { id: media.id, siteConfigId: siteConfig.id }, data: { tags: newTags } })
        successCount += result.count
      } catch { failedCount++ }
    }
  } else if (action === "delete") {
    const result = await prisma.siteMedia.deleteMany({ where: scope })
    successCount = result.count
  } else {
    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
  }

  return NextResponse.json({ success: true, successCount, failedCount })
}

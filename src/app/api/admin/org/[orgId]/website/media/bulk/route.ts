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

  if (!action || !mediaIds?.length) return NextResponse.json({ success: false, message: "action and mediaIds required" }, { status: 400 })

  let successCount = 0
  let failedCount = 0

  if (action === "move" && folder) {
    const result = await prisma.siteMedia.updateMany({ where: { id: { in: mediaIds } }, data: { folder } })
    successCount = result.count
  } else if (action === "tag" && tags?.length) {
    for (const id of mediaIds) {
      try {
        const media = await prisma.siteMedia.findUnique({ where: { id }, select: { tags: true } })
        if (media) {
          const newTags = [...new Set([...media.tags, ...tags])]
          await prisma.siteMedia.update({ where: { id }, data: { tags: newTags } })
          successCount++
        }
      } catch { failedCount++ }
    }
  } else if (action === "delete") {
    const result = await prisma.siteMedia.deleteMany({ where: { id: { in: mediaIds } } })
    successCount = result.count
  } else {
    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
  }

  return NextResponse.json({ success: true, successCount, failedCount })
}

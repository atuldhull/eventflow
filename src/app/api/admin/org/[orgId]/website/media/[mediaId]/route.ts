import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

async function loadOrgScopedMedia(orgId: string, mediaId: string) {
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { organizationId: orgId },
    select: { id: true },
  })
  if (!siteConfig) return null

  const media = await prisma.siteMedia.findUnique({ where: { id: mediaId } })
  if (!media || media.siteConfigId !== siteConfig.id) return null
  return media
}

// GET — Single media detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string; mediaId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, mediaId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const media = await loadOrgScopedMedia(orgId, mediaId)
  if (!media) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  return NextResponse.json({ success: true, data: media })
}

// PATCH — Update media metadata
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; mediaId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, mediaId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const media = await loadOrgScopedMedia(orgId, mediaId)
  if (!media) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  const body = await req.json()
  const updateData: Record<string, unknown> = {}
  if (body.fileName !== undefined) updateData.fileName = body.fileName
  if (body.altText !== undefined) updateData.altText = body.altText
  if (body.folder !== undefined) updateData.folder = body.folder
  if (body.tags !== undefined) updateData.tags = body.tags

  const updated = await prisma.siteMedia.update({ where: { id: mediaId }, data: updateData })

  return NextResponse.json({ success: true, data: updated })
}

// DELETE — Delete media file
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string; mediaId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, mediaId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const media = await loadOrgScopedMedia(orgId, mediaId)
  if (!media) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  await prisma.siteMedia.delete({ where: { id: mediaId } })

  return NextResponse.json({ success: true })
}

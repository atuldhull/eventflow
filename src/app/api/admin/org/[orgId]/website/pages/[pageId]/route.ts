import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — Single page detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string; pageId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, pageId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const page = await prisma.sitePage.findUnique({ where: { id: pageId } })
  if (!page) return NextResponse.json({ success: false, message: "Page not found" }, { status: 404 })

  return NextResponse.json({ success: true, data: page })
}

// PATCH — Update page
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; pageId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, pageId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const page = await prisma.sitePage.findUnique({ where: { id: pageId } })
  if (!page) return NextResponse.json({ success: false, message: "Page not found" }, { status: 404 })

  const body = await req.json()
  const updateData: any = {}
  if (body.title !== undefined) updateData.title = body.title
  if (body.slug !== undefined) updateData.slug = body.slug
  if (body.sections !== undefined) updateData.sections = body.sections
  if (body.isPublished !== undefined) updateData.isPublished = body.isPublished
  if (body.showInNav !== undefined) updateData.showInNav = body.showInNav
  if (body.navOrder !== undefined) updateData.navOrder = body.navOrder

  const updated = await prisma.sitePage.update({ where: { id: pageId }, data: updateData })

  return NextResponse.json({ success: true, data: updated })
}

// DELETE — Delete page
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string; pageId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, pageId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  await prisma.sitePage.delete({ where: { id: pageId } })

  return NextResponse.json({ success: true })
}

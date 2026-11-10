import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// Every lookup is scoped to the site that belongs to the authorized org, so a pageId
// from another organization's site resolves to "not found" instead of being readable
// or writable by an admin who was only authorized for :orgId.
function pageInOrg(orgId: string, pageId: string) {
  return { id: pageId, siteConfig: { organizationId: orgId } }
}

// GET — Single page detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string; pageId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, pageId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const page = await prisma.sitePage.findFirst({ where: pageInOrg(orgId, pageId) })
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

  const page = await prisma.sitePage.findFirst({ where: pageInOrg(orgId, pageId), select: { id: true } })
  if (!page) return NextResponse.json({ success: false, message: "Page not found" }, { status: 404 })

  const body = await req.json()
  const updateData: any = {}
  if (body.title !== undefined) updateData.title = body.title
  if (body.slug !== undefined) updateData.slug = body.slug
  if (body.sections !== undefined) updateData.sections = body.sections
  if (body.isPublished !== undefined) updateData.isPublished = body.isPublished
  if (body.showInNav !== undefined) updateData.showInNav = body.showInNav
  if (body.navOrder !== undefined) updateData.navOrder = body.navOrder

  const updated = await prisma.sitePage.update({ where: { id: page.id }, data: updateData })

  return NextResponse.json({ success: true, data: updated })
}

// DELETE — Delete page
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string; pageId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, pageId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const { count } = await prisma.sitePage.deleteMany({ where: pageInOrg(orgId, pageId) })
  if (count === 0) return NextResponse.json({ success: false, message: "Page not found" }, { status: 404 })

  return NextResponse.json({ success: true })
}

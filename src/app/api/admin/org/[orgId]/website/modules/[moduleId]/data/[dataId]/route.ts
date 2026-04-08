import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// GET — Single data entry
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string; moduleId: string; dataId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, dataId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const entry = await prisma.featureModuleData.findUnique({ where: { id: dataId } })
  if (!entry || entry.organizationId !== orgId) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  return NextResponse.json({ success: true, data: entry })
}

// PATCH — Update data entry
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; moduleId: string; dataId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, dataId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const entry = await prisma.featureModuleData.findUnique({ where: { id: dataId } })
  if (!entry || entry.organizationId !== orgId) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  const body = await req.json()
  const updateData: any = { updatedById: session.user.id }
  if (body.title !== undefined) updateData.title = body.title
  if (body.data !== undefined) updateData.data = body.data
  if (body.isPublished !== undefined) updateData.isPublished = body.isPublished
  if (body.isActive !== undefined) updateData.isActive = body.isActive

  const updated = await prisma.featureModuleData.update({ where: { id: dataId }, data: updateData })

  return NextResponse.json({ success: true, data: updated })
}

// DELETE — Delete data entry
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string; moduleId: string; dataId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, dataId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const entry = await prisma.featureModuleData.findUnique({ where: { id: dataId } })
  if (!entry || entry.organizationId !== orgId) return NextResponse.json({ success: false, message: "Not found" }, { status: 404 })

  await prisma.featureModuleData.delete({ where: { id: dataId } })

  return NextResponse.json({ success: true })
}

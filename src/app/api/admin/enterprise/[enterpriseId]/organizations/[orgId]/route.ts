import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId, orgId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_VIEW, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const org = await prisma.organization.findFirst({
    where: { id: orgId, enterpriseId, deletedAt: null },
    include: {
      _count: { select: { events: true, members: true } },
    },
  })

  if (!org) {
    return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: org })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId, orgId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_EDIT, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  try {
    const body = await request.json()
    const org = await prisma.organization.updateMany({
      where: { id: orgId, enterpriseId },
      data: body,
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "ORGANIZATION",
      entityId: orgId,
      description: "Updated organization",
      newValues: body,
      ipAddress,
      userAgent,
      enterpriseId,
      organizationId: orgId,
    })

    return NextResponse.json({ success: true, message: "Organization updated" })
  } catch (error) {
    console.error("Update org error:", error)
    return NextResponse.json({ success: false, message: "Failed to update" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId, orgId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.ORG_DELETE, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  try {
    await prisma.organization.updateMany({
      where: { id: orgId, enterpriseId },
      data: { deletedAt: new Date(), isActive: false },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "DELETE",
      entityType: "ORGANIZATION",
      entityId: orgId,
      description: "Deleted organization",
      ipAddress,
      userAgent,
      enterpriseId,
      organizationId: orgId,
    })

    return NextResponse.json({ success: true, message: "Organization deleted" })
  } catch (error) {
    console.error("Delete org error:", error)
    return NextResponse.json({ success: false, message: "Failed to delete" }, { status: 500 })
  }
}

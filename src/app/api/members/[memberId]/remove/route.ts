import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { canManageRole, PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import type { Role } from "@/lib/constants"
import { z } from "zod/v4"

const removeSchema = z.object({
  entityType: z.enum(["ENTERPRISE", "ORGANIZATION"] as const),
  entityId: z.string().min(1),
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { memberId } = await params
    const body = await request.json()
    const parsed = removeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed" },
        { status: 400 }
      )
    }

    const { entityType, entityId } = parsed.data
    const context = entityType === "ENTERPRISE" ? { enterpriseId: entityId } : { organizationId: entityId }

    const authResult = await authorize(session.user.id, PERMISSIONS.MEMBER_REMOVE, context)
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
    }

    let member: { userId: string; role: string } | null = null
    if (entityType === "ENTERPRISE") {
      member = await prisma.enterpriseMember.findUnique({
        where: { id: memberId },
        select: { userId: true, role: true },
      })
    } else {
      member = await prisma.organizationMember.findUnique({
        where: { id: memberId },
        select: { userId: true, role: true },
      })
    }

    if (!member) {
      return NextResponse.json({ success: false, message: "Member not found." }, { status: 404 })
    }

    if (member.userId === session.user.id) {
      return NextResponse.json({ success: false, message: "You cannot remove yourself." }, { status: 400 })
    }

    const userRole = session.user.role as Role
    if (!canManageRole(userRole, member.role as Role)) {
      return NextResponse.json({ success: false, message: "You cannot remove a member with equal or higher role." }, { status: 403 })
    }

    if (entityType === "ENTERPRISE") {
      await prisma.enterpriseMember.update({ where: { id: memberId }, data: { isActive: false } })
    } else {
      await prisma.organizationMember.update({ where: { id: memberId }, data: { isActive: false } })
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "DELETE",
      entityType: "USER",
      entityId: member.userId,
      description: "Removed member from " + entityType.toLowerCase(),
      oldValues: { role: member.role, isActive: true },
      newValues: { isActive: false },
      ipAddress,
      userAgent,
      ...(entityType === "ENTERPRISE" ? { enterpriseId: entityId } : { organizationId: entityId }),
    })

    return NextResponse.json({ success: true, message: "Member removed successfully." })
  } catch (error) {
    console.error("Remove member error:", error)
    return NextResponse.json({ success: false, message: "Something went wrong." }, { status: 500 })
  }
}

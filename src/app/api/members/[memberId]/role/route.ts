import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { canManageRole, PERMISSIONS, getRoleLabel } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import type { Role } from "@/lib/constants"
import { z } from "zod/v4"

const changeRoleSchema = z.object({
  role: z.enum(["ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER", "ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER"] as const),
  entityType: z.enum(["ENTERPRISE", "ORGANIZATION"] as const),
  entityId: z.string().min(1),
})

export async function PATCH(
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
    const parsed = changeRoleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { role: newRole, entityType, entityId } = parsed.data
    const context = entityType === "ENTERPRISE" ? { enterpriseId: entityId } : { organizationId: entityId }

    const authResult = await authorize(session.user.id, PERMISSIONS.MEMBER_CHANGE_ROLE, context)
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
    }

    // Get current member
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
      return NextResponse.json({ success: false, message: "You cannot change your own role." }, { status: 400 })
    }

    const userRole = session.user.role as Role
    if (!canManageRole(userRole, member.role as Role)) {
      return NextResponse.json({ success: false, message: "You cannot modify a member with equal or higher role." }, { status: 403 })
    }

    if (!canManageRole(userRole, newRole as Role)) {
      return NextResponse.json({ success: false, message: "You cannot assign this role." }, { status: 403 })
    }

    const oldRole = member.role
    if (entityType === "ENTERPRISE") {
      await prisma.enterpriseMember.update({ where: { id: memberId }, data: { role: newRole as Role } })
    } else {
      await prisma.organizationMember.update({ where: { id: memberId }, data: { role: newRole as Role } })
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "USER",
      entityId: member.userId,
      description: `Changed role from ${getRoleLabel(oldRole as Role)} to ${getRoleLabel(newRole as Role)}`,
      oldValues: { role: oldRole },
      newValues: { role: newRole },
      ipAddress,
      userAgent,
      ...(entityType === "ENTERPRISE" ? { enterpriseId: entityId } : { organizationId: entityId }),
    })

    return NextResponse.json({ success: true, message: "Role updated successfully." })
  } catch (error) {
    console.error("Change role error:", error)
    return NextResponse.json({ success: false, message: "Something went wrong." }, { status: 500 })
  }
}

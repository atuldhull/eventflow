import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize, isEnterpriseOwner } from "@/lib/authorization"
import { canManageEnterpriseRole, canManageRole, PERMISSIONS } from "@/lib/permissions"
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

    // Authorize by the caller's role IN this enterprise/organization (their membership, or
    // SUPER_ADMIN), never by their global role, which can come from a different tenant.
    const authResult = await authorize(session.user.id, PERMISSIONS.MEMBER_REMOVE, context)
    if (!authResult.authorized || !authResult.role) {
      return NextResponse.json(
        { success: false, message: authResult.message || "You don't have permission to perform this action." },
        { status: 403 }
      )
    }
    const actorRole = authResult.role

    // Scope the lookup to the entity the caller was authorized for: a membership id from
    // another enterprise/organization must resolve to "not found".
    let member: { userId: string; role: string; isActive: boolean } | null = null
    if (entityType === "ENTERPRISE") {
      member = await prisma.enterpriseMember.findFirst({
        where: { id: memberId, enterpriseId: entityId },
        select: { userId: true, role: true, isActive: true },
      })
    } else {
      member = await prisma.organizationMember.findFirst({
        where: { id: memberId, organizationId: entityId },
        select: { userId: true, role: true, isActive: true },
      })
    }

    if (!member) {
      return NextResponse.json({ success: false, message: "Member not found." }, { status: 404 })
    }

    if (member.userId === session.user.id) {
      return NextResponse.json({ success: false, message: "You cannot remove yourself." }, { status: 400 })
    }

    if (entityType === "ENTERPRISE" && (await isEnterpriseOwner(entityId, member.userId))) {
      return NextResponse.json(
        { success: false, message: "The enterprise owner cannot be removed. Transfer ownership first." },
        { status: 403 }
      )
    }

    // In an enterprise its owner may also remove co-admins (other ENTERPRISE_ADMINs)
    const outranks = entityType === "ENTERPRISE"
      ? canManageEnterpriseRole(actorRole, member.role as Role, await isEnterpriseOwner(entityId, session.user.id))
      : canManageRole(actorRole, member.role as Role)
    if (!outranks) {
      return NextResponse.json({ success: false, message: "You cannot remove a member with equal or higher role." }, { status: 403 })
    }

    if (member.isActive === false) {
      return NextResponse.json({ success: false, message: "This member has already been removed." }, { status: 409 })
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

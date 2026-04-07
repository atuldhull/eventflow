import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import crypto from "crypto"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { canManageRole, PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import type { Role } from "@/lib/constants"
import { z } from "zod/v4"

const inviteSchema = z.object({
  email: z.email("Invalid email address"),
  role: z.enum(["ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER", "ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER"] as const),
  entityType: z.enum(["ENTERPRISE", "ORGANIZATION"] as const),
  entityId: z.string().min(1),
  message: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = inviteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, role, entityType, entityId, message } = parsed.data

    // Check permission
    const context = entityType === "ENTERPRISE"
      ? { enterpriseId: entityId }
      : { organizationId: entityId }

    const authResult = await authorize(session.user.id, PERMISSIONS.MEMBER_INVITE, context)
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
    }

    // Check role hierarchy
    const userRole = session.user.role as Role
    if (!canManageRole(userRole, role as Role)) {
      return NextResponse.json(
        { success: false, message: "You cannot assign a role equal to or above your own." },
        { status: 403 }
      )
    }

    // Check if already a member
    if (entityType === "ENTERPRISE") {
      const existing = await prisma.enterpriseMember.findFirst({
        where: { enterpriseId: entityId, user: { email }, isActive: true },
      })
      if (existing) {
        return NextResponse.json({ success: false, message: "This user is already a member." }, { status: 409 })
      }
    } else {
      const existing = await prisma.organizationMember.findFirst({
        where: { organizationId: entityId, user: { email }, isActive: true },
      })
      if (existing) {
        return NextResponse.json({ success: false, message: "This user is already a member." }, { status: 409 })
      }
    }

    // Get entity name for email
    let entityName = ""
    if (entityType === "ENTERPRISE") {
      const ent = await prisma.enterprise.findUnique({ where: { id: entityId }, select: { name: true } })
      entityName = ent?.name || "the enterprise"
    } else {
      const org = await prisma.organization.findUnique({ where: { id: entityId }, select: { name: true } })
      entityName = org?.name || "the organization"
    }

    // Check if user exists, if so add directly
    const targetUser = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } })

    if (targetUser) {
      if (entityType === "ENTERPRISE") {
        await prisma.enterpriseMember.create({
          data: {
            enterpriseId: entityId,
            userId: targetUser.id,
            role: role as Role,
            invitedBy: session.user.id,
          },
        })
      } else {
        await prisma.organizationMember.create({
          data: {
            organizationId: entityId,
            userId: targetUser.id,
            role: role as Role,
            invitedBy: session.user.id,
          },
        })
      }
    }

    // Send invite email
    const inviterName = session.user.name || "A team member"
    await sendEmail({
      to: email,
      subject: `You've been invited to join ${entityName} on EventFlow`,
      html: `
        <h2>You've been invited!</h2>
        <p>${inviterName} has invited you to join <strong>${entityName}</strong> as <strong>${role.replace(/_/g, " ")}</strong>.</p>
        ${message ? `<p>Message: "${message}"</p>` : ""}
        <p>${targetUser ? "You have been added automatically." : "Sign up to get started."}</p>
      `,
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: entityType === "ENTERPRISE" ? "ENTERPRISE" : "ORGANIZATION",
      entityId,
      description: `Invited ${email} as ${role}`,
      newValues: { email, role },
      ipAddress,
      userAgent,
      ...(entityType === "ENTERPRISE" ? { enterpriseId: entityId } : { organizationId: entityId }),
    })

    return NextResponse.json(
      { success: true, message: targetUser ? "Member added successfully." : "Invitation sent." },
      { status: 201 }
    )
  } catch (error) {
    console.error("Invite error:", error)
    return NextResponse.json({ success: false, message: "Something went wrong." }, { status: 500 })
  }
}

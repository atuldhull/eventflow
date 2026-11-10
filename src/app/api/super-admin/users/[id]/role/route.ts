import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { getRoleLabel } from "@/lib/permissions"
import type { Role } from "@/lib/constants"
import { z } from "zod/v4"

const roleSchema = z.object({
  role: z.enum(["SUPER_ADMIN", "ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER", "ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER", "USER"] as const),
})

export const PATCH = withSuperAdmin(async (req, { user, params }) => {
  const parsed = roleSchema.safeParse(await req.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid role" }, { status: 400 })
  }

  // A super admin demoting themselves could leave the platform with no one able to undo it.
  if (params.id === user.id) {
    return NextResponse.json({ success: false, message: "You can't change your own role" }, { status: 400 })
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { role: true, name: true },
  })

  if (!targetUser) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
  }

  if (targetUser.role === parsed.data.role) {
    return NextResponse.json({ success: true, message: "Role unchanged" })
  }

  await prisma.user.update({
    where: { id: params.id },
    data: { role: parsed.data.role },
  })

  const { ipAddress, userAgent } = getClientInfo(req)
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "USER",
    entityId: params.id,
    description: `Changed ${targetUser.name}'s role from ${getRoleLabel(targetUser.role as Role)} to ${getRoleLabel(parsed.data.role as Role)}`,
    oldValues: { role: targetUser.role },
    newValues: { role: parsed.data.role },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ success: true, message: "Role updated" })
})

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
  const body = await req.json()
  const parsed = roleSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid role" }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { role: true, name: true },
  })

  if (!targetUser) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { role: parsed.data.role },
  })

  const { ipAddress, userAgent } = getClientInfo(req)
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "USER",
    entityId: params.id,
    description: `Changed role from ${getRoleLabel(targetUser.role as Role)} to ${getRoleLabel(parsed.data.role as Role)}`,
    oldValues: { role: targetUser.role },
    newValues: { role: parsed.data.role },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ success: true, message: "Role updated" })
})

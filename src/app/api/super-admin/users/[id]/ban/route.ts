import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { z } from "zod/v4"

const banSchema = z.object({
  reason: z.string().optional(),
})

export const PATCH = withSuperAdmin(async (req, { user, params }) => {
  const body = await req.json()
  const parsed = banSchema.safeParse(body)

  const targetUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { isBanned: true, name: true, role: true },
  })

  if (!targetUser) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
  }

  if (targetUser.role === "SUPER_ADMIN") {
    return NextResponse.json({ success: false, message: "Cannot ban a super admin" }, { status: 403 })
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      isBanned: !targetUser.isBanned,
      banReason: !targetUser.isBanned ? (parsed.data?.reason || null) : null,
    },
  })

  const { ipAddress, userAgent } = getClientInfo(req)
  await createAuditLog({
    userId: user.id,
    action: updated.isBanned ? "UPDATE" : "UPDATE",
    entityType: "USER",
    entityId: params.id,
    description: `${updated.isBanned ? "Banned" : "Unbanned"} user: ${targetUser.name}`,
    oldValues: { isBanned: targetUser.isBanned },
    newValues: { isBanned: updated.isBanned },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ success: true, message: `User ${updated.isBanned ? "banned" : "unbanned"}` })
})

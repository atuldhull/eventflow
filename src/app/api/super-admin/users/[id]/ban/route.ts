import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { z } from "zod/v4"

const banSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

/** Toggles the ban. Banning needs no reason, but one is stored when given. */
export const PATCH = withSuperAdmin(async (req, { user, params }) => {
  const parsed = banSchema.safeParse((await req.json().catch(() => ({}))) ?? {})
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Reason must be 500 characters or fewer" }, { status: 400 })
  }

  if (params.id === user.id) {
    return NextResponse.json({ success: false, message: "You can't ban yourself" }, { status: 400 })
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: params.id, deletedAt: null },
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
      banReason: !targetUser.isBanned ? (parsed.data.reason || null) : null,
    },
  })

  const { ipAddress, userAgent } = getClientInfo(req)
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "USER",
    entityId: params.id,
    description: `${updated.isBanned ? "Banned" : "Unbanned"} user: ${targetUser.name}${updated.isBanned && parsed.data.reason ? ` (${parsed.data.reason})` : ""}`,
    oldValues: { isBanned: targetUser.isBanned },
    newValues: { isBanned: updated.isBanned },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({
    success: true,
    message: `${targetUser.name} ${updated.isBanned ? "banned" : "unbanned"}`,
    data: { isBanned: updated.isBanned },
  })
})

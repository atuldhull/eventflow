import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"

export const PATCH = withSuperAdmin(async (req, { user, params }) => {
  const enterprise = await prisma.enterprise.findUnique({
    where: { id: params.id },
    select: { isActive: true, name: true },
  })

  if (!enterprise) {
    return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })
  }

  const updated = await prisma.enterprise.update({
    where: { id: params.id },
    data: { isActive: !enterprise.isActive },
  })

  const { ipAddress, userAgent } = getClientInfo(req)
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "ENTERPRISE",
    entityId: params.id,
    description: `${updated.isActive ? "Activated" : "Deactivated"} enterprise: ${enterprise.name}`,
    oldValues: { isActive: enterprise.isActive },
    newValues: { isActive: updated.isActive },
    ipAddress,
    userAgent,
    enterpriseId: params.id,
  })

  return NextResponse.json({ success: true, data: updated })
})

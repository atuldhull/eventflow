import { NextResponse } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"

export const PATCH = withSuperAdmin(async (req, { user, params }) => {
  const enterprise = await prisma.enterprise.findUnique({
    where: { id: params.id },
    select: { isVerified: true, name: true },
  })

  if (!enterprise) {
    return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })
  }

  const updated = await prisma.enterprise.update({
    where: { id: params.id },
    data: { isVerified: !enterprise.isVerified },
  })

  const { ipAddress, userAgent } = getClientInfo(req)
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "ENTERPRISE",
    entityId: params.id,
    description: `${updated.isVerified ? "Verified" : "Unverified"} enterprise: ${enterprise.name}`,
    oldValues: { isVerified: enterprise.isVerified },
    newValues: { isVerified: updated.isVerified },
    ipAddress,
    userAgent,
    enterpriseId: params.id,
  })

  return NextResponse.json({ success: true, data: updated })
})

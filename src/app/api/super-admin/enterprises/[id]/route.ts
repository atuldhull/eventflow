import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"

export const GET = withSuperAdmin(async (req, { params }) => {
  const enterprise = await prisma.enterprise.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { organizations: true, events: true, members: true } },
    },
  })

  if (!enterprise) {
    return NextResponse.json({ success: false, message: "Enterprise not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: enterprise })
})

export const PATCH = withSuperAdmin(async (req, { user, params }) => {
  try {
    const body = await req.json()
    const enterprise = await prisma.enterprise.update({
      where: { id: params.id },
      data: body,
    })

    const { ipAddress, userAgent } = getClientInfo(req)
    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "ENTERPRISE",
      entityId: params.id,
      description: `Updated enterprise: ${enterprise.name}`,
      newValues: body,
      ipAddress,
      userAgent,
      enterpriseId: params.id,
    })

    return NextResponse.json({ success: true, data: enterprise })
  } catch (error) {
    console.error("Update enterprise error:", error)
    return NextResponse.json({ success: false, message: "Failed to update enterprise" }, { status: 500 })
  }
})

export const DELETE = withSuperAdmin(async (req, { user, params }) => {
  try {
    await prisma.enterprise.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    })

    const { ipAddress, userAgent } = getClientInfo(req)
    await createAuditLog({
      userId: user.id,
      action: "DELETE",
      entityType: "ENTERPRISE",
      entityId: params.id,
      description: "Deleted enterprise",
      ipAddress,
      userAgent,
      enterpriseId: params.id,
    })

    return NextResponse.json({ success: true, message: "Enterprise deleted" })
  } catch (error) {
    console.error("Delete enterprise error:", error)
    return NextResponse.json({ success: false, message: "Failed to delete enterprise" }, { status: 500 })
  }
})

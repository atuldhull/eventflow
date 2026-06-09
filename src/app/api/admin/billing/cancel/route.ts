import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { z } from "zod/v4"

const cancelSchema = z.object({
  entityType: z.enum(["enterprise", "org"]),
  entityId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })
    }

    const { entityType, entityId } = parsed.data

    const { authorized, message } = await authorize(
      session.user.id,
      entityType === "org" ? PERMISSIONS.ORG_MANAGE_SETTINGS : PERMISSIONS.ENTERPRISE_MANAGE_BILLING,
      entityType === "org" ? { organizationId: entityId } : { enterpriseId: entityId }
    )
    if (!authorized) {
      return NextResponse.json({ success: false, message }, { status: 403 })
    }

    const subscription = entityType === "org"
      ? await prisma.subscription.findFirst({ where: { organizationId: entityId } })
      : await prisma.subscription.findFirst({ where: { enterprise: { id: entityId } } })

    if (!subscription) {
      return NextResponse.json({ success: false, message: "No active subscription" }, { status: 404 })
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "CANCEL",
      entityType: entityType === "enterprise" ? "ENTERPRISE" : "ORGANIZATION",
      entityId,
      description: "Cancelled subscription",
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ success: true, message: "Subscription cancelled. Access continues until end of billing period." })
  } catch (error) {
    console.error("Cancel error:", error)
    return NextResponse.json({ success: false, message: "Failed to cancel" }, { status: 500 })
  }
}

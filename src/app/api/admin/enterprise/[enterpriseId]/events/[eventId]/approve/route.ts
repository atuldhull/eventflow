import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { enterpriseId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_PUBLISH, { enterpriseId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const body = await request.json()
  const { action, reason } = body as { action: "approve" | "reject"; reason?: string }

  const event = await prisma.event.findFirst({
    where: { id: eventId, OR: [{ enterpriseId }, { organization: { enterpriseId } }], status: "PENDING_APPROVAL" },
    select: { id: true, title: true, organizationId: true, createdById: true },
  })

  if (!event) return NextResponse.json({ success: false, message: "Event not found or not pending approval" }, { status: 404 })

  if (action === "approve") {
    await prisma.event.update({ where: { id: eventId }, data: { status: "PUBLISHED", publishedAt: new Date() } })

    if (event.createdById) {
      await prisma.notification.create({
        data: { userId: event.createdById, type: "EVENT" as any, category: "EVENT" as any, title: "Event Approved", message: `Your event "${event.title}" has been approved and is now published!` },
      })
    }
  } else {
    await prisma.event.update({ where: { id: eventId }, data: { status: "DRAFT" } })

    if (event.createdById) {
      await prisma.notification.create({
        data: { userId: event.createdById, type: "EVENT" as any, category: "EVENT" as any, title: "Event Rejected", message: `Your event "${event.title}" was rejected.${reason ? ` Reason: ${reason}` : ""}` },
      })
    }
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id, action: action === "approve" ? "APPROVE" : "REJECT", entityType: "EVENT",
    entityId: eventId, description: `${action === "approve" ? "Approved" : "Rejected"} event: ${event.title}${reason ? ` — ${reason}` : ""}`,
    ipAddress, userAgent, enterpriseId, organizationId: event.organizationId || undefined,
  })

  return NextResponse.json({ success: true, message: `Event ${action === "approve" ? "approved" : "rejected"}` })
}

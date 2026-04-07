import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createBulkNotifications } from "@/lib/notifications"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { z } from "zod/v4"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const announcements = await prisma.announcement.findMany({
    where: { event: { organizationId: orgId } },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { title: true } },
      createdBy: { select: { name: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: announcements.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      publishedAt: a.publishedAt?.toISOString() || null,
    })),
  })
}

const announcementSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  isPinned: z.boolean().default(false),
  sendAsEmail: z.boolean().default(false),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.COMMUNICATION_SEND_ANNOUNCEMENT, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = announcementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const announcement = await prisma.announcement.create({
      data: {
        eventId: parsed.data.eventId,
        title: parsed.data.title,
        content: parsed.data.content,
        priority: parsed.data.priority,
        isPinned: parsed.data.isPinned,
        publishedAt: new Date(),
        createdById: session.user.id,
      },
    })

    // Notify registered participants
    const registrations = await prisma.registration.findMany({
      where: { eventId: parsed.data.eventId, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      select: { userId: true },
    })

    const event = await prisma.event.findUnique({
      where: { id: parsed.data.eventId },
      select: { title: true },
    })

    if (registrations.length > 0) {
      await createBulkNotifications(
        registrations.map((r) => r.userId),
        {
          type: "IN_APP",
          category: "ANNOUNCEMENT",
          title: parsed.data.title,
          message: `New update for ${event?.title || "event"}`,
          eventId: parsed.data.eventId,
          senderId: session.user.id,
        }
      )
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "EVENT",
      entityId: parsed.data.eventId,
      description: `Posted announcement: ${parsed.data.title}`,
      ipAddress,
      userAgent,
      organizationId: orgId,
    })

    return NextResponse.json({ success: true, data: announcement }, { status: 201 })
  } catch (error) {
    console.error("Create announcement error:", error)
    return NextResponse.json({ success: false, message: "Failed to create announcement" }, { status: 500 })
  }
}

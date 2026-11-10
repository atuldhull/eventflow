import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { deliverAnnouncement } from "@/lib/org-announcements"
import { z } from "zod/v4"

/** This organization's announcements, drafts (publishedAt null) included. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  // was readable by any signed-in user for any organization, drafts included
  const authResult = await authorize(
    session.user.id,
    [PERMISSIONS.COMMUNICATION_VIEW_HISTORY, PERMISSIONS.COMMUNICATION_SEND_ANNOUNCEMENT],
    { organizationId: orgId }
  )
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const announcements = await prisma.announcement.findMany({
    where: { event: { organizationId: orgId, deletedAt: null } },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true, eventId: true, title: true, content: true, priority: true, isPinned: true,
      publishedAt: true, createdAt: true, updatedAt: true,
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
  eventId: z.string().min(1).max(50),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10_000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  isPinned: z.boolean().default(false),
  sendAsEmail: z.boolean().default(false),
  /** false saves a draft: nothing is sent until it is published */
  publish: z.boolean().default(true),
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
    const parsed = announcementSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const input = parsed.data

    // The event must be one of this organization's: an event id from another tenant is
    // "not found" (before, any event on the platform could be posted to).
    const event = await prisma.event.findFirst({
      where: { id: input.eventId, organizationId: orgId, deletedAt: null },
      select: { id: true, title: true, organization: { select: { name: true } } },
    })
    if (!event) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
    }

    const announcement = await prisma.announcement.create({
      data: {
        eventId: event.id,
        title: input.title,
        content: input.content,
        priority: input.priority,
        isPinned: input.isPinned,
        publishedAt: input.publish ? new Date() : null,
        createdById: session.user.id,
      },
    })

    const reached = input.publish
      ? await deliverAnnouncement({
          announcement,
          eventTitle: event.title,
          organizerName: event.organization?.name ?? "The organizer",
          senderId: session.user.id,
          sendAsEmail: input.sendAsEmail,
        })
      : 0

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: input.publish ? "PUBLISH" : "CREATE",
      entityType: "EVENT",
      entityId: event.id,
      description: input.publish ? `Posted announcement: ${input.title}` : `Saved announcement draft: ${input.title}`,
      eventId: event.id,
      ipAddress,
      userAgent,
      organizationId: orgId,
    })

    return NextResponse.json(
      {
        success: true,
        message: input.publish
          ? `Announcement posted to ${reached} participant${reached === 1 ? "" : "s"}`
          : "Draft saved",
        data: announcement,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create announcement error:", error)
    return NextResponse.json({ success: false, message: "Failed to create announcement" }, { status: 500 })
  }
}

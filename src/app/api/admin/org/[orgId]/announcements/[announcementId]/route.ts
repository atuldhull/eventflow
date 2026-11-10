import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { deliverAnnouncement } from "@/lib/org-announcements"

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), sendAsEmail: z.boolean().default(false) }),
  z.object({ action: z.literal("pin"), isPinned: z.boolean() }),
])

type Ctx = { params: Promise<{ orgId: string; announcementId: string }> }

async function authorizeFor(
  orgId: string
): Promise<{ ok: false; error: NextResponse } | { ok: true; session: { user: { id: string } } }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) }
  }
  const authResult = await authorize(session.user.id, PERMISSIONS.COMMUNICATION_SEND_ANNOUNCEMENT, { organizationId: orgId })
  if (!authResult.authorized) {
    return { ok: false, error: NextResponse.json({ success: false, message: authResult.message }, { status: 403 }) }
  }
  return { ok: true, session: { user: { id: session.user.id } } }
}

/** Finds the announcement only among this organization's events. */
function findScoped(orgId: string, announcementId: string) {
  return prisma.announcement.findFirst({
    where: { id: announcementId, event: { organizationId: orgId } },
    select: {
      id: true, eventId: true, title: true, content: true, publishedAt: true,
      event: { select: { title: true, organization: { select: { name: true } } } },
    },
  })
}

/** Publishes a draft (notifying participants) or pins/unpins an announcement. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { orgId, announcementId } = await params
  const authed = await authorizeFor(orgId)
  if (!authed.ok) return authed.error
  const { session } = authed

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })

  const announcement = await findScoped(orgId, announcementId)
  if (!announcement) return NextResponse.json({ success: false, message: "Announcement not found" }, { status: 404 })

  const { ipAddress, userAgent } = getClientInfo(request)

  if (parsed.data.action === "pin") {
    await prisma.announcement.update({ where: { id: announcement.id }, data: { isPinned: parsed.data.isPinned } })
    return NextResponse.json({ success: true, message: parsed.data.isPinned ? "Pinned" : "Unpinned" })
  }

  if (announcement.publishedAt) {
    return NextResponse.json({ success: false, message: "Already published" }, { status: 409 })
  }
  // only the first of two simultaneous publishes sends anything
  const { count } = await prisma.announcement.updateMany({
    where: { id: announcement.id, publishedAt: null },
    data: { publishedAt: new Date() },
  })
  if (count === 0) return NextResponse.json({ success: false, message: "Already published" }, { status: 409 })

  const reached = await deliverAnnouncement({
    announcement,
    eventTitle: announcement.event.title,
    organizerName: announcement.event.organization?.name ?? "The organizer",
    senderId: session.user.id,
    sendAsEmail: parsed.data.sendAsEmail,
  })

  await createAuditLog({
    userId: session.user.id,
    action: "PUBLISH",
    entityType: "EVENT",
    entityId: announcement.eventId,
    description: `Posted announcement: ${announcement.title}`,
    eventId: announcement.eventId,
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  return NextResponse.json({ success: true, message: `Announcement posted to ${reached} participant${reached === 1 ? "" : "s"}` })
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { orgId, announcementId } = await params
  const authed = await authorizeFor(orgId)
  if (!authed.ok) return authed.error
  const { session } = authed

  const announcement = await findScoped(orgId, announcementId)
  if (!announcement) return NextResponse.json({ success: false, message: "Announcement not found" }, { status: 404 })

  await prisma.announcement.delete({ where: { id: announcement.id } })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    entityType: "EVENT",
    entityId: announcement.eventId,
    description: `Deleted announcement: ${announcement.title}`,
    eventId: announcement.eventId,
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  return NextResponse.json({ success: true, message: "Announcement deleted" })
}

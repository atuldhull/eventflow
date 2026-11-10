import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Events whose page is public (a cancelled one still shows its notices).
const VISIBLE_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED"]
const ACTIVE_REGISTRATION = ["PENDING", "CONFIRMED", "WAITLISTED", "CHECKED_IN", "NO_SHOW"] as const
const MAX_ANNOUNCEMENTS = 10

/** Registered attendees and members of the hosting organization or enterprise. */
async function isInsider(event: { id: string; organizationId: string | null; enterpriseId: string | null }, userId: string) {
  const [registration, orgMember, entMember] = await Promise.all([
    prisma.registration.findFirst({ where: { eventId: event.id, userId, status: { in: [...ACTIVE_REGISTRATION] } }, select: { id: true } }),
    event.organizationId
      ? prisma.organizationMember.findFirst({ where: { organizationId: event.organizationId, userId, isActive: true }, select: { id: true } })
      : null,
    event.enterpriseId
      ? prisma.enterpriseMember.findFirst({ where: { enterpriseId: event.enterpriseId, userId, isActive: true }, select: { id: true } })
      : null,
  ])
  return !!(registration || orgMember || entMember)
}

/**
 * The event's published announcements for its public page: pinned first, then newest.
 * Drafts (no publishedAt) are never listed. Private and invite-only events list them only
 * to attendees and the organizers' team, like the rest of their details.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!slug || slug.length > 200) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  const event = await prisma.event.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, status: true, visibility: true, organizationId: true, enterpriseId: true },
  })
  if (!event || !VISIBLE_STATUSES.includes(event.status)) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  if (event.visibility === "PRIVATE" || event.visibility === "INVITE_ONLY") {
    const session = await auth()
    if (!session?.user?.id || !(await isInsider(event, session.user.id))) {
      return NextResponse.json({ success: true, message: "", data: [] })
    }
  }

  const announcements = await prisma.announcement.findMany({
    where: { eventId: event.id, publishedAt: { not: null, lte: new Date() } },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    take: MAX_ANNOUNCEMENTS,
    select: { id: true, title: true, content: true, priority: true, isPinned: true, publishedAt: true },
  })

  return NextResponse.json({
    success: true,
    message: "",
    data: announcements.map((a) => ({ ...a, publishedAt: a.publishedAt?.toISOString() ?? null })),
  })
}

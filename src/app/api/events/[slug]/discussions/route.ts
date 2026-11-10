import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Event discussion messages, stored as IN_APP notifications whose data.eventId points at
// the event (there is no dedicated table).

// Events whose page is public; drafts and pending ones have no discussion to show
const VISIBLE_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED"]
// A registration that still counts (cancelled or rejected attendees can't post)
const ACTIVE_REGISTRATION = ["PENDING", "CONFIRMED", "WAITLISTED", "CHECKED_IN", "NO_SHOW"] as const

const listQuery = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) })
const postBody = z.object({ message: z.string().trim().min(1, "Message required").max(500, "Message too long (max 500 chars)") })

async function findEvent(slug: string) {
  return prisma.event.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, title: true, visibility: true, status: true, organizationId: true, enterpriseId: true },
  })
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const query = listQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) return NextResponse.json({ success: false, message: "Invalid page" }, { status: 400 })

  const event = await findEvent(slug)
  if (!event || !VISIBLE_STATUSES.includes(event.status)) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  // Private and invite-only events: only attendees and the organizers' team may read
  if (event.visibility === "PRIVATE" || event.visibility === "INVITE_ONLY") {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ success: false, message: "Login required" }, { status: 401 })
    if (!(await isInsider(event, session.user.id))) {
      return NextResponse.json({ success: false, message: "Only participants can read this discussion" }, { status: 403 })
    }
  }

  const limit = 20
  const messages = await prisma.notification.findMany({
    where: {
      type: "IN_APP",
      category: "ANNOUNCEMENT",
      title: { startsWith: `Discussion: ` },
      data: { path: ["eventId"], equals: event.id },
    },
    orderBy: { createdAt: "desc" },
    skip: (query.data.page - 1) * limit,
    take: limit,
    select: { id: true, message: true, createdAt: true, user: { select: { name: true, avatar: true } } },
  })

  return NextResponse.json({
    success: true,
    data: messages.map(m => ({ id: m.id, author: m.user.name, avatar: m.user.avatar, message: m.message, createdAt: m.createdAt.toISOString() })),
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Login required to post" }, { status: 401 })

  const { slug } = await params
  const body = postBody.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ success: false, message: body.error.issues[0]?.message ?? "Message required" }, { status: 400 })
  }

  const event = await findEvent(slug)
  if (!event || !VISIBLE_STATUSES.includes(event.status)) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  // Only attendees with a registration that still stands can post
  const registration = await prisma.registration.findFirst({
    where: { eventId: event.id, userId: session.user.id, status: { in: [...ACTIVE_REGISTRATION] } },
    select: { id: true },
  })
  if (!registration) return NextResponse.json({ success: false, message: "Only registered participants can post in discussions" }, { status: 403 })

  await prisma.notification.create({
    data: {
      userId: session.user.id,
      type: "IN_APP",
      category: "ANNOUNCEMENT",
      title: `Discussion: ${event.title}`,
      message: body.data.message,
      data: { eventId: event.id, type: "discussion" },
    },
  })

  return NextResponse.json({ success: true, message: "Posted" }, { status: 201 })
}

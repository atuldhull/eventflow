import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// Event discussion messages stored in a dedicated table or via event metadata
// Using a simple approach: messages stored in a separate lightweight structure

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, visibility: true },
  })

  if (!event) return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })

  // For private events, require auth
  if (event.visibility === "PRIVATE" || event.visibility === "INVITE_ONLY") {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ success: false, message: "Login required" }, { status: 401 })
  }

  const sp = request.nextUrl.searchParams
  const page = parseInt(sp.get("page") || "1")
  const limit = 20

  // Use Notification model as a lightweight message store via metadata
  // In production, you'd have a dedicated Discussion/Comment model
  const messages = await prisma.notification.findMany({
    where: { type: "IN_APP", category: "ANNOUNCEMENT", data: { path: ["eventId"], equals: event.id }, title: { startsWith: "Discussion:" } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    select: { id: true, title: true, message: true, createdAt: true, user: { select: { name: true, avatar: true } } },
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
  const { message } = await request.json()

  if (!message || message.trim().length === 0) return NextResponse.json({ success: false, message: "Message required" }, { status: 400 })
  if (message.length > 500) return NextResponse.json({ success: false, message: "Message too long (max 500 chars)" }, { status: 400 })

  const event = await prisma.event.findUnique({ where: { slug }, select: { id: true, title: true } })
  if (!event) return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })

  // Verify user is registered for this event (only registered attendees can discuss)
  const registration = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
  })
  if (!registration) return NextResponse.json({ success: false, message: "Only registered participants can post in discussions" }, { status: 403 })

  await prisma.notification.create({
    data: {
      userId: session.user.id,
      type: "IN_APP",
      category: "ANNOUNCEMENT",
      title: `Discussion: ${event.title}`,
      message: message.trim(),
      data: { eventId: event.id, type: "discussion" },
    },
  })

  return NextResponse.json({ success: true, message: "Posted" }, { status: 201 })
}

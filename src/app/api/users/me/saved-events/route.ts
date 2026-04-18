import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET — list saved events for the current user
export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const saved = await prisma.savedEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { savedAt: "desc" },
    include: {
      event: {
        select: {
          id: true, title: true, slug: true, shortDescription: true,
          coverImage: true, category: true, status: true,
          startDate: true, endDate: true,
          venue: true, venueCity: true, isOnline: true, isPaid: true,
          currentRegistrations: true, maxCapacity: true,
          organization: { select: { id: true, name: true, logo: true } },
        },
      },
    },
  })

  const data = saved
    // Hide events the organizer has since deleted / unpublished to draft
    .filter((s) => ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"].includes(s.event.status))
    .map((s) => ({
      savedAt: s.savedAt.toISOString(),
      ...s.event,
      startDate: s.event.startDate.toISOString(),
      endDate: s.event.endDate.toISOString(),
    }))

  return NextResponse.json({ success: true, data })
}

// POST — save an event for the current user
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { eventId } = await request.json() as { eventId?: string }
  if (!eventId) {
    return NextResponse.json({ success: false, message: "eventId required" }, { status: 400 })
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, status: true } })
  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  try {
    await prisma.savedEvent.upsert({
      where: { userId_eventId: { userId: session.user.id, eventId } },
      create: { userId: session.user.id, eventId },
      update: {},
    })
  } catch (err) {
    console.error("saved-events POST failed:", err)
    return NextResponse.json({ success: false, message: "Failed to save event" }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { saved: true } })
}

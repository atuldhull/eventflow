import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { z } from "zod/v4"
import type { EventStatus, EventVisibility } from "@prisma/client"

// Only events anyone can see can be saved: published (or later), public or unlisted, not deleted.
const SAVEABLE_STATUSES: EventStatus[] = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"]
const SAVEABLE_VISIBILITY: EventVisibility[] = ["PUBLIC", "UNLISTED"]
const saveSchema = z.object({ eventId: z.string().trim().min(1).max(64) })

// GET — list saved events for the current user
export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const saved = await prisma.savedEvent.findMany({
    // Events the organizer has since deleted, unpublished to draft or made private are left out
    where: {
      userId: session.user.id,
      event: { deletedAt: null, status: { in: SAVEABLE_STATUSES }, visibility: { in: SAVEABLE_VISIBILITY } },
    },
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

  const data = saved.map((s) => ({
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

  const parsed = saveSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "eventId required" }, { status: 400 })
  }
  const { eventId } = parsed.data

  // A draft, private or deleted event answers like a missing one: its id reveals nothing
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, status: true, visibility: true, deletedAt: true } })
  if (!event || event.deletedAt || !SAVEABLE_STATUSES.includes(event.status) || !SAVEABLE_VISIBILITY.includes(event.visibility)) {
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

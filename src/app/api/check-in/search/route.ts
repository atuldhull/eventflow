import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

const querySchema = z.object({
  eventId: z.string().trim().min(1).max(64),
  search: z.string().trim().max(100).default(""),
})

/**
 * Door search within one event: a participant's name or email, the ticket number printed
 * under the QR ("TKT-…") or the registration number ("EVT-…"), case-insensitive.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const sp = request.nextUrl.searchParams
  const parsed = querySchema.safeParse({ eventId: sp.get("eventId") ?? "", search: sp.get("search") ?? "" })
  if (!parsed.success) {
    const missingEvent = parsed.error.issues.some((i) => i.path[0] === "eventId")
    return NextResponse.json({ success: false, message: missingEvent ? "Event ID required" : "Invalid search" }, { status: 400 })
  }
  const { eventId, search } = parsed.data

  const authResult = await authorize(session.user.id, PERMISSIONS.CHECKIN_VIEW, { eventId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  if (search.length < 2) {
    return NextResponse.json({ success: true, data: [] })
  }

  const registrations = await prisma.registration.findMany({
    where: {
      eventId,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      OR: [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { registrationNumber: { contains: search, mode: "insensitive" } },
        { ticket: { is: { ticketNumber: { contains: search, mode: "insensitive" } } } },
      ],
    },
    take: 20,
    orderBy: { status: "asc" },
    select: {
      id: true,
      registrationNumber: true,
      status: true,
      user: { select: { name: true, email: true, avatar: true } },
      ticketType: { select: { name: true } },
      ticket: { select: { ticketNumber: true } },
      checkIn: { select: { id: true, checkedInAt: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: registrations.map((r) => ({
      registrationId: r.id,
      registrationNumber: r.registrationNumber,
      ticketNumber: r.ticket?.ticketNumber ?? null,
      participant: { name: r.user.name, email: r.user.email, avatar: r.user.avatar },
      ticketType: r.ticketType.name,
      isCheckedIn: r.status === "CHECKED_IN",
      checkedInAt: r.checkIn?.checkedInAt?.toISOString() || null,
      checkInId: r.checkIn?.id || null,
    })),
  })
}

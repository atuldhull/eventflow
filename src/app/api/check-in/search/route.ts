import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const eventId = request.nextUrl.searchParams.get("eventId")
  const search = request.nextUrl.searchParams.get("search") || ""

  if (!eventId) {
    return NextResponse.json({ success: false, message: "Event ID required" }, { status: 400 })
  }

  const authResult = await authorize(session.user.id, PERMISSIONS.CHECKIN_VIEW, { eventId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  if (!search || search.length < 2) {
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
      checkIn: { select: { id: true, checkedInAt: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: registrations.map((r) => ({
      registrationId: r.id,
      registrationNumber: r.registrationNumber,
      participant: { name: r.user.name, email: r.user.email, avatar: r.user.avatar },
      ticketType: r.ticketType.name,
      isCheckedIn: r.status === "CHECKED_IN",
      checkedInAt: r.checkIn?.checkedInAt?.toISOString() || null,
      checkInId: r.checkIn?.id || null,
    })),
  })
}

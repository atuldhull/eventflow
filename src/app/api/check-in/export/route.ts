import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { csvResponse, toCsv } from "@/lib/csv-export"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const eventId = request.nextUrl.searchParams.get("eventId")?.slice(0, 64)
  if (!eventId) {
    return NextResponse.json({ success: false, message: "Event ID required" }, { status: 400 })
  }

  const authResult = await authorize(session.user.id, [PERMISSIONS.REGISTRATION_EXPORT, PERMISSIONS.CHECKIN_MANAGE], { eventId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const registrations = await prisma.registration.findMany({
    where: { eventId, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      ticketType: { select: { name: true } },
      checkIn: { select: { checkedInAt: true, checkInMethod: true, location: true, performer: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  })

  const headers = ["Name", "Email", "Phone", "Ticket Type", "Registration #", "Status", "Check-in Time", "Check-in Method", "Checked By", "Location"]
  const rows = registrations.map((r) => {
    const ci = r.checkIn
    return [
      r.user.name,
      r.user.email,
      r.user.phone || "",
      r.ticketType.name,
      r.registrationNumber,
      r.status,
      ci?.checkedInAt?.toISOString() || "",
      ci?.checkInMethod || "",
      ci?.performer?.name || "",
      ci?.location || "",
    ]
  })

  return csvResponse(`attendance-${eventId.slice(0, 8)}.csv`, toCsv(headers, rows))
}

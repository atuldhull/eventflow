import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: true, data: { registered: false } })
  }

  const eventId = request.nextUrl.searchParams.get("eventId")
  if (!eventId) {
    return NextResponse.json({ success: false, message: "eventId required" }, { status: 400 })
  }

  const registration = await prisma.registration.findUnique({
    where: { eventId_userId: { eventId, userId: session.user.id } },
    select: {
      id: true,
      registrationNumber: true,
      status: true,
      ticket: { select: { ticketNumber: true, qrCode: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: { registered: !!registration, registration },
  })
}

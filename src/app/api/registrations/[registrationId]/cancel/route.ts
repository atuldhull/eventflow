import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { registrationId } = await params

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true, userId: true, status: true, eventId: true,
      event: { select: { title: true, startDate: true } },
      payment: { select: { couponId: true } },
    },
  })

  if (!registration) {
    return NextResponse.json({ success: false, message: "Registration not found" }, { status: 404 })
  }

  if (registration.userId !== session.user.id) {
    return NextResponse.json({ success: false, message: "Not your registration" }, { status: 403 })
  }

  if (registration.status === "CANCELLED") {
    return NextResponse.json({ success: false, message: "Already cancelled" }, { status: 400 })
  }

  if (registration.status === "CHECKED_IN") {
    return NextResponse.json({ success: false, message: "Cannot cancel after check-in" }, { status: 400 })
  }

  // Don't allow cancellation if event already started
  if (new Date(registration.event.startDate) < new Date()) {
    return NextResponse.json({ success: false, message: "Cannot cancel after event has started" }, { status: 400 })
  }

  const couponId = registration.payment?.couponId

  await prisma.$transaction([
    prisma.registration.update({ where: { id: registrationId }, data: { status: "CANCELLED" } }),
    prisma.ticket.updateMany({ where: { registrationId }, data: { status: "CANCELLED" } }),
    prisma.event.update({ where: { id: registration.eventId }, data: { currentRegistrations: { decrement: 1 } } }),
    ...(couponId ? [prisma.coupon.update({ where: { id: couponId }, data: { currentUses: { decrement: 1 } } })] : []),
  ])

  return NextResponse.json({ success: true, message: "Registration cancelled successfully" })
}

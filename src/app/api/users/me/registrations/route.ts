import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { holdExpiresAt } from "@/lib/registration-capacity"

/**
 * What the attendee sees for a registration. PENDING covers two different waits: a paid
 * registration holding its seat while payment is completed, and one awaiting the
 * organizer's approval. Everything else is the registration's own status.
 */
function registrationDisplayStatus(reg: {
  status: string
  metadata: Prisma.JsonValue | null
  payment: { status: string; amount: unknown } | null
}): string {
  if (reg.status !== "PENDING") return reg.status
  const held = holdExpiresAt(reg) !== null
  const paymentOpen = !!reg.payment && Number(reg.payment.amount) > 0 && ["PENDING", "PROCESSING"].includes(reg.payment.status)
  return held || paymentOpen ? "PENDING_PAYMENT" : "PENDING_APPROVAL"
}

/** Every registration of the signed-in user (any status), newest event first. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const registrations = await prisma.registration.findMany({
    where: { userId: session.user.id, event: { deletedAt: null } },
    orderBy: { event: { startDate: "desc" } },
    take: 500,
    select: {
      id: true,
      registrationNumber: true,
      status: true,
      metadata: true,
      waitlistPosition: true,
      createdAt: true,
      event: {
        select: {
          id: true, title: true, slug: true, startDate: true, endDate: true, venue: true, venueCity: true,
          isOnline: true, category: true, organization: { select: { name: true } },
        },
      },
      ticketType: { select: { name: true } },
      ticket: { select: { id: true, status: true, ticketNumber: true } },
      payment: { select: { status: true, amount: true, currency: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: registrations.map((r) => ({
      id: r.id,
      registrationNumber: r.registrationNumber,
      status: r.status,
      displayStatus: registrationDisplayStatus(r),
      holdExpiresAt: holdExpiresAt(r)?.toISOString() ?? null,
      waitlistPosition: r.waitlistPosition,
      createdAt: r.createdAt.toISOString(),
      ticketType: r.ticketType.name,
      ticket: r.ticket,
      payment: r.payment ? { status: r.payment.status, amount: Number(r.payment.amount), currency: r.payment.currency } : null,
      event: {
        ...r.event,
        startDate: r.event.startDate.toISOString(),
        endDate: r.event.endDate.toISOString(),
      },
    })),
  })
}

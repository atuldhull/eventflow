import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; paymentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, paymentId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.PAYMENT_MANAGE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const { amount, reason } = await request.json() as { amount?: number; reason?: string }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, registration: { event: { organizationId: orgId } } },
    select: {
      id: true, amount: true, status: true, userId: true, registrationId: true, couponId: true,
      registration: { select: { eventId: true, event: { select: { title: true } } } },
    },
  })

  if (!payment) {
    return NextResponse.json({ success: false, message: "Payment not found" }, { status: 404 })
  }

  if (payment.status === "REFUNDED") {
    return NextResponse.json({ success: false, message: "Already refunded" }, { status: 400 })
  }

  if (payment.status !== "COMPLETED") {
    return NextResponse.json({ success: false, message: "Can only refund completed payments" }, { status: 400 })
  }

  const refundAmount = amount || Number(payment.amount)
  if (refundAmount > Number(payment.amount)) {
    return NextResponse.json({ success: false, message: "Refund amount exceeds payment amount" }, { status: 400 })
  }

  // Process refund (mark as refunded — actual gateway refund would happen via Razorpay/Stripe SDK)
  const eventId = payment.registration?.eventId
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: { status: "REFUNDED", refundAmount: refundAmount, refundReason: reason || null, refundedAt: new Date() },
    }),
    ...(payment.registrationId ? [
      prisma.registration.update({
        where: { id: payment.registrationId },
        data: { status: "CANCELLED" },
      }),
      prisma.ticket.updateMany({
        where: { registrationId: payment.registrationId },
        data: { status: "CANCELLED" },
      }),
    ] : []),
    ...(eventId ? [
      prisma.event.update({
        where: { id: eventId },
        data: { currentRegistrations: { decrement: 1 } },
      }),
    ] : []),
    ...(payment.couponId ? [
      prisma.coupon.update({
        where: { id: payment.couponId },
        data: { currentUses: { decrement: 1 } },
      }),
    ] : []),
  ])

  // Notify user
  await prisma.notification.create({
    data: {
      userId: payment.userId,
      type: "PAYMENT" as any,
      category: "PAYMENT" as any,
      title: "Refund Processed",
      message: `Your payment of ₹${refundAmount} for "${payment.registration?.event.title}" has been refunded.${reason ? ` Reason: ${reason}` : ""}`,
    },
  })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "PAYMENT",
    entityId: paymentId,
    description: `Refunded ₹${refundAmount} for ${payment.registration?.event.title}`,
    ipAddress, userAgent, organizationId: orgId,
  })

  return NextResponse.json({ success: true, message: `₹${refundAmount} refunded successfully` })
}

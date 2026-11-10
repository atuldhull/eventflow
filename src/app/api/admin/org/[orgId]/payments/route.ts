import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { paginationMeta, parseListParams } from "@/lib/list-params"
import { orgPaymentWhere, parsePaymentFilters } from "@/lib/org-payments"
import { revenueTotals } from "@/lib/revenue"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.PAYMENT_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const { page, limit, skip } = parseListParams(searchParams, { defaultLimit: 20 })
  const filters = parsePaymentFilters(searchParams)

  // The list is filtered; the KPIs above it describe the whole organization.
  const listWhere = orgPaymentWhere(orgId, filters)
  const orgWhere = orgPaymentWhere(orgId, {})

  const [payments, total, revenue, pending] = await Promise.all([
    prisma.payment.findMany({
      where: listWhere,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, paymentNumber: true, amount: true, refundAmount: true, currency: true, status: true, method: true, createdAt: true,
        user: { select: { name: true, email: true } },
        registration: { select: { status: true, event: { select: { id: true, title: true, status: true } } } },
      },
    }),
    prisma.payment.count({ where: listWhere }),
    revenueTotals(orgWhere),
    prisma.payment.count({ where: { ...orgWhere, status: "PENDING" } }),
  ])

  // Paid tickets of cancelled events that still hold money: the organizer owes these refunds.
  const awaitingRefund = await prisma.payment.groupBy({
    by: ["eventId"],
    where: { ...orgWhere, status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] }, event: { status: "CANCELLED" } },
    _count: { _all: true },
  })
  const cancelledEvents = awaitingRefund.length
    ? await prisma.event.findMany({ where: { id: { in: awaitingRefund.map((r) => r.eventId) } }, select: { id: true, title: true } })
    : []

  return NextResponse.json({
    success: true,
    data: payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber || p.id.slice(0, 8),
      participantName: p.user?.name || "—",
      participantEmail: p.user?.email || "",
      eventId: p.registration?.event?.id ?? null,
      eventTitle: p.registration?.event?.title || "—",
      eventCancelled: p.registration?.event?.status === "CANCELLED",
      amount: Number(p.amount),
      refundAmount: Number(p.refundAmount ?? 0),
      status: p.status,
      method: p.method || "—",
      createdAt: p.createdAt.toISOString(),
    })),
    stats: {
      // everything collected (refunded payments included); net = totalRevenue - refunds
      totalRevenue: revenue.gross,
      refunds: revenue.refunds,
      pending,
    },
    awaitingRefund: awaitingRefund.map((r) => ({
      eventId: r.eventId,
      eventTitle: cancelledEvents.find((e) => e.id === r.eventId)?.title ?? "Cancelled event",
      payments: r._count._all,
    })),
    pagination: paginationMeta(page, limit, total),
  })
}

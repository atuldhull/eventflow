import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { cleanSearch, enterprisePaymentWhere, parsePaging } from "@/lib/enterprise-admin"
import { revenueTotals } from "@/lib/revenue"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.PAYMENT_VIEW, { enterpriseId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const sp = request.nextUrl.searchParams
  const { page, limit, skip } = parsePaging(sp, 20)
  const search = cleanSearch(sp.get("search"))

  // KPIs describe the whole enterprise; only the list narrows with the search.
  const scope = enterprisePaymentWhere(enterpriseId)
  const where = enterprisePaymentWhere(enterpriseId, search)

  const [payments, total, revenue, pending] = await Promise.all([
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, select: { id: true, paymentNumber: true, amount: true, status: true, method: true, createdAt: true, user: { select: { name: true } }, registration: { select: { event: { select: { title: true, organization: { select: { name: true } } } } } } } }),
    prisma.payment.count({ where }),
    revenueTotals(scope),
    prisma.payment.count({ where: { ...scope, status: "PENDING" } }),
  ])

  return NextResponse.json({
    success: true,
    data: payments.map((p) => ({ id: p.id, paymentNumber: p.paymentNumber || p.id.slice(0, 8), participantName: p.user?.name || "—", eventTitle: p.registration?.event?.title || "—", organization: p.registration?.event?.organization?.name || "Direct", amount: Number(p.amount), status: p.status, method: p.method || "—", createdAt: p.createdAt.toISOString() })),
    stats: { totalRevenue: revenue.gross, refunds: revenue.refunds, pending },
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}

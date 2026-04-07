import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

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
  const page = parseInt(sp.get("page") || "1")
  const limit = parseInt(sp.get("limit") || "20")

  const paymentWhere: any = { registration: { event: { deletedAt: null, OR: [{ enterpriseId }, { organization: { enterpriseId } }] } } }

  const [payments, total, revenue, refunds, pending] = await Promise.all([
    prisma.payment.findMany({ where: paymentWhere, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, select: { id: true, paymentNumber: true, amount: true, status: true, method: true, createdAt: true, user: { select: { name: true } }, registration: { select: { event: { select: { title: true, organization: { select: { name: true } } } } } } } }),
    prisma.payment.count({ where: paymentWhere }),
    prisma.payment.aggregate({ where: { ...paymentWhere, status: "COMPLETED" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...paymentWhere, status: "REFUNDED" }, _sum: { amount: true } }),
    prisma.payment.count({ where: { ...paymentWhere, status: "PENDING" } }),
  ])

  return NextResponse.json({
    success: true,
    data: payments.map((p) => ({ id: p.id, paymentNumber: p.paymentNumber || p.id.slice(0, 8), participantName: p.user?.name || "—", eventTitle: p.registration?.event?.title || "—", organization: p.registration?.event?.organization?.name || "Direct", amount: Number(p.amount), status: p.status, method: p.method || "—", createdAt: p.createdAt.toISOString() })),
    stats: { totalRevenue: Number(revenue._sum.amount || 0), refunds: Number(refunds._sum.amount || 0), pending },
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}

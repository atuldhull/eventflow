import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { csvResponse, exportDateStamp, toCsv } from "@/lib/csv-export"
import { orgPaymentWhere, parsePaymentFilters } from "@/lib/org-payments"

/** A spreadsheet can't usefully hold more; the list's filters narrow a bigger export. */
const MAX_ROWS = 10_000

/** The organization's payments as CSV, with the same search and status filters as the list. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.PAYMENT_EXPORT, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const filters = parsePaymentFilters(request.nextUrl.searchParams)
  const payments = await prisma.payment.findMany({
    where: orgPaymentWhere(orgId, filters),
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      paymentNumber: true, amount: true, currency: true, status: true, method: true,
      discountAmount: true, taxAmount: true, refundAmount: true, gatewayPaymentId: true,
      createdAt: true, paidAt: true, refundedAt: true,
      user: { select: { name: true, email: true } },
      registration: { select: { registrationNumber: true, event: { select: { title: true } } } },
      coupon: { select: { code: true } },
    },
  })

  const headers = [
    "Payment #", "Created", "Paid", "Participant", "Email", "Event", "Registration #", "Status", "Method",
    "Amount", "Currency", "Discount", "Coupon", "Tax", "Refunded", "Refunded on", "Gateway payment ID",
  ]
  const rows = payments.map((p) => [
    p.paymentNumber,
    p.createdAt.toISOString(),
    p.paidAt?.toISOString() ?? "",
    p.user?.name ?? "",
    p.user?.email ?? "",
    p.registration?.event?.title ?? "",
    p.registration?.registrationNumber ?? "",
    p.status,
    p.method,
    Number(p.amount),
    p.currency,
    p.discountAmount === null ? "" : Number(p.discountAmount),
    p.coupon?.code ?? "",
    p.taxAmount === null ? "" : Number(p.taxAmount),
    p.refundAmount === null ? "" : Number(p.refundAmount),
    p.refundedAt?.toISOString() ?? "",
    p.gatewayPaymentId ?? "",
  ])

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "EXPORT",
    entityType: "PAYMENT",
    entityId: orgId,
    description: `Exported ${payments.length} payments`,
    newValues: { search: filters.search ?? null, status: filters.status ?? null, rows: payments.length },
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  return csvResponse(`payments-${exportDateStamp()}.csv`, toCsv(headers, rows))
}

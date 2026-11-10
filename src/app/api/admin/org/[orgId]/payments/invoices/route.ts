import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { csvResponse, toCsv } from "@/lib/csv-export"

const DAY_MS = 24 * 60 * 60 * 1000
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const querySchema = z.object({ dateFrom: isoDay.optional(), dateTo: isoDay.optional() })

// Returns a CSV of the organization's invoices (completed payments) for accounting/Tally
// import. `dateFrom` and `dateTo` are whole days (UTC), both included.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.PAYMENT_EXPORT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 })

  const toDay = parsed.data.dateTo ?? new Date().toISOString().slice(0, 10)
  const fromDay = parsed.data.dateFrom ?? new Date(Date.parse(toDay) - 30 * DAY_MS).toISOString().slice(0, 10)
  const dateFrom = new Date(`${fromDay}T00:00:00.000Z`)
  const dateTo = new Date(`${toDay}T23:59:59.999Z`)
  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime()) || dateFrom > dateTo) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 })
  }

  const payments = await prisma.payment.findMany({
    where: {
      status: "COMPLETED",
      paidAt: { gte: dateFrom, lte: dateTo },
      registration: { event: { organizationId: orgId } },
    },
    orderBy: { paidAt: "asc" },
    take: 10_000,
    select: {
      paymentNumber: true, amount: true, currency: true, taxAmount: true, discountAmount: true,
      method: true, gatewayPaymentId: true, paidAt: true,
      user: { select: { name: true, email: true } },
      registration: { select: { event: { select: { title: true } }, ticketType: { select: { name: true } } } },
      coupon: { select: { code: true } },
    },
  })

  const headers = ["Invoice #", "Date", "Participant", "Email", "Event", "Ticket Type", "Gross Amount", "Discount", "Coupon Code", "Tax Amount", "Net Amount", "Payment Method", "Gateway ID"]
  const rows = payments.map((p) => {
    const gross = Number(p.amount)
    const discount = Number(p.discountAmount || 0)
    const tax = Number(p.taxAmount || 0)
    const net = gross - discount + tax
    // matches the number generateInvoiceData (src/lib/invoice.ts) prints on the invoice
    const year = new Date().getFullYear()
    return [
      `INV-${year}-${(p.paymentNumber || "").replace("PAY-", "")}`,
      p.paidAt ? p.paidAt.toISOString().split("T")[0] : "",
      p.user?.name || "",
      p.user?.email || "",
      p.registration?.event?.title || "",
      p.registration?.ticketType?.name || "General",
      gross.toFixed(2),
      discount.toFixed(2),
      p.coupon?.code || "",
      tax.toFixed(2),
      net.toFixed(2),
      p.method || "",
      p.gatewayPaymentId || "",
    ]
  })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "EXPORT",
    entityType: "PAYMENT",
    entityId: orgId,
    description: `Exported ${payments.length} invoices for ${fromDay} to ${toDay}`,
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  return csvResponse(`invoices-${fromDay}-to-${toDay}.csv`, toCsv(headers, rows))
}

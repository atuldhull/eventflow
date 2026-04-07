import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// Returns a CSV of all invoices for accounting/Tally import
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.PAYMENT_EXPORT, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const sp = request.nextUrl.searchParams
  const dateFrom = sp.get("dateFrom") ? new Date(sp.get("dateFrom")!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const dateTo = sp.get("dateTo") ? new Date(sp.get("dateTo")!) : new Date()

  const payments = await prisma.payment.findMany({
    where: {
      status: "COMPLETED",
      paidAt: { gte: dateFrom, lte: dateTo },
      registration: { event: { organizationId: orgId } },
    },
    orderBy: { paidAt: "asc" },
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
    return [
      `INV-${new Date().getFullYear()}-${(p.paymentNumber || "").replace("PAY-", "")}`,
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

  const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${dateFrom.toISOString().split("T")[0]}-to-${dateTo.toISOString().split("T")[0]}.csv"`,
    },
  })
}

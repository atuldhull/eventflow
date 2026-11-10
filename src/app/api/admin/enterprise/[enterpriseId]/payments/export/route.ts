import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { cleanSearch, enterprisePaymentWhere } from "@/lib/enterprise-admin"
import { csvResponse, exportDateStamp, toCsv } from "@/lib/csv-export"

const EXPORT_LIMIT = 10_000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.PAYMENT_EXPORT, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const search = cleanSearch(request.nextUrl.searchParams.get("search"))
  const payments = await prisma.payment.findMany({
    where: enterprisePaymentWhere(enterpriseId, search),
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    select: {
      paymentNumber: true, amount: true, currency: true, status: true, method: true, createdAt: true,
      user: { select: { name: true, email: true } },
      registration: { select: { registrationNumber: true, event: { select: { title: true, organization: { select: { name: true } } } } } },
    },
  })

  const csv = toCsv(
    ["Payment #", "Participant", "Email", "Event", "Organization", "Registration #", "Amount", "Currency", "Status", "Method", "Date"],
    payments.map((p) => [
      p.paymentNumber,
      p.user?.name,
      p.user?.email,
      p.registration?.event?.title,
      p.registration?.event?.organization?.name || "Direct",
      p.registration?.registrationNumber,
      Number(p.amount),
      p.currency,
      p.status,
      p.method,
      p.createdAt,
    ])
  )

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "EXPORT",
    entityType: "PAYMENT",
    entityId: enterpriseId,
    description: `Exported ${payments.length} payment${payments.length === 1 ? "" : "s"}${search ? ` matching "${search}"` : ""}`,
    ipAddress,
    userAgent,
    enterpriseId,
  })

  return csvResponse(`payments-${exportDateStamp()}.csv`, csv)
}

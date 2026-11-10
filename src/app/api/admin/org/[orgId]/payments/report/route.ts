import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { getRevenueReport, getDailyRevenue } from "@/lib/financial-reports"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { csvResponse, toCsv } from "@/lib/csv-export"

const DAY_MS = 24 * 60 * 60 * 1000
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const querySchema = z.object({
  dateFrom: isoDay.optional(),
  dateTo: isoDay.optional(),
  format: z.enum(["json", "csv"]).default("json"),
})

/**
 * Revenue for a date range. `dateFrom` and `dateTo` are whole days (YYYY-MM-DD, UTC), both
 * included, so a range ending today counts today's payments. `format=csv` downloads the
 * report and needs the export permission on top of report access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.PAYMENT_VIEW_REPORTS, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 })
  }
  const { format } = parsed.data

  if (format === "csv") {
    const canExport = await authorize(session.user.id, PERMISSIONS.PAYMENT_EXPORT, { organizationId: orgId })
    if (!canExport.authorized) {
      return NextResponse.json({ success: false, message: canExport.message }, { status: 403 })
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const toDay = parsed.data.dateTo ?? today
  const fromDay = parsed.data.dateFrom ?? new Date(Date.parse(toDay) - 30 * DAY_MS).toISOString().slice(0, 10)
  const dateFrom = new Date(`${fromDay}T00:00:00.000Z`)
  const dateTo = new Date(`${toDay}T23:59:59.999Z`)
  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime()) || dateFrom > dateTo) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 })
  }
  if (dateTo.getTime() - dateFrom.getTime() > 3 * 366 * DAY_MS) {
    return NextResponse.json({ success: false, message: "Choose a range of three years or less" }, { status: 400 })
  }

  const [report, dailyRevenue] = await Promise.all([
    getRevenueReport({ entityType: "org", entityId: orgId, dateFrom, dateTo }),
    getDailyRevenue({ entityType: "org", entityId: orgId, dateFrom, dateTo }),
  ])

  if (format === "csv") {
    const rows: (string | number)[][] = [
      ["Summary", "Gross revenue", "", report.totalRevenue, report.totalTransactions],
      ["Summary", "Discounts", "", report.totalDiscount, ""],
      ["Summary", "Refunds", "", report.totalRefunds, ""],
      ["Summary", "Net revenue", "", report.netRevenue, ""],
      ...report.byEvent.map((e) => ["By event", e.eventTitle, "", e.revenue, e.transactions]),
      ...report.byMethod.map((m) => ["By method", m.method, "", m.revenue, m.count]),
      ...report.byTicketType.map((t) => ["By ticket type", t.ticketType, "", t.revenue, t.count]),
      ...dailyRevenue.map((d) => ["Daily", "Revenue", d.date, d.revenue, ""]),
    ]

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "EXPORT",
      entityType: "PAYMENT",
      entityId: orgId,
      description: `Exported the financial report for ${fromDay} to ${toDay}`,
      ipAddress,
      userAgent,
      organizationId: orgId,
    })

    return csvResponse(
      `financial-report-${fromDay}-to-${toDay}.csv`,
      toCsv(["Section", "Item", "Date", "Revenue (INR)", "Transactions"], rows)
    )
  }

  return NextResponse.json({
    success: true,
    data: { ...report, dailyRevenue, dateFrom: fromDay, dateTo: toDay },
  })
}

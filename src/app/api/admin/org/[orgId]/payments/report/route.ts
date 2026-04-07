import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { getRevenueReport, getDailyRevenue } from "@/lib/financial-reports"

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

  const searchParams = request.nextUrl.searchParams
  const dateFrom = new Date(searchParams.get("dateFrom") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  const dateTo = new Date(searchParams.get("dateTo") || new Date().toISOString())

  const [report, dailyRevenue] = await Promise.all([
    getRevenueReport({ entityType: "org", entityId: orgId, dateFrom, dateTo }),
    getDailyRevenue({ entityType: "org", entityId: orgId, dateFrom, dateTo }),
  ])

  return NextResponse.json({
    success: true,
    data: { ...report, dailyRevenue },
  })
}

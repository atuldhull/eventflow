import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS, getRolePermissions } from "@/lib/permissions"
import { getEventAnalytics, getEventFunnel } from "@/lib/analytics"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ANALYTICS_VIEW_BASIC, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  // The analytics helpers take a bare event id, so the event must be this organization's.
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    select: { id: true, title: true },
  })
  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  const searchParams = request.nextUrl.searchParams
  const parseDate = (v: string | null) => {
    const d = v ? new Date(v) : null
    return d && !Number.isNaN(d.getTime()) ? d : undefined
  }
  const dateFrom = parseDate(searchParams.get("dateFrom"))
  const dateTo = parseDate(searchParams.get("dateTo"))

  const [analytics, funnel] = await Promise.all([
    getEventAnalytics(eventId, dateFrom, dateTo),
    getEventFunnel(eventId),
  ])

  // Money figures only for people who may see payments.
  const canSeeRevenue = !!authResult.role && getRolePermissions(authResult.role).includes(PERMISSIONS.PAYMENT_VIEW)
  const data = canSeeRevenue
    ? { ...analytics, funnel, title: event.title }
    : {
        ...analytics,
        overview: { ...analytics.overview, revenue: null },
        revenueBreakdown: null,
        ticketDistribution: analytics.ticketDistribution.map((t) => ({ ...t, revenue: null })),
        funnel,
        title: event.title,
      }

  return NextResponse.json({ success: true, data })
}

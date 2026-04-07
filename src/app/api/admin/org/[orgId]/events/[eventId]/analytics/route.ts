import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
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

  const searchParams = request.nextUrl.searchParams
  const dateFrom = searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined
  const dateTo = searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined

  const [analytics, funnel] = await Promise.all([
    getEventAnalytics(eventId, dateFrom, dateTo),
    getEventFunnel(eventId),
  ])

  return NextResponse.json({ success: true, data: { ...analytics, funnel } })
}

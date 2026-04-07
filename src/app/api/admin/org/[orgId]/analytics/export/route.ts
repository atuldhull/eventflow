import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { generateCSVReport } from "@/lib/analytics"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.ANALYTICS_EXPORT, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const events = await prisma.event.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: {
      title: true, startDate: true, status: true, currentRegistrations: true, maxCapacity: true, isPaid: true,
      _count: { select: { checkIns: true, feedbacks: true } },
    },
    orderBy: { startDate: "desc" },
  })

  const data = events.map((e) => ({
    Event: e.title,
    Date: e.startDate.toISOString().slice(0, 10),
    Status: e.status,
    Registrations: e.currentRegistrations,
    Capacity: e.maxCapacity || "Unlimited",
    CheckIns: e._count.checkIns,
    Feedbacks: e._count.feedbacks,
    Paid: e.isPaid ? "Yes" : "No",
  }))

  const csv = generateCSVReport(data as any, ["Event", "Date", "Status", "Registrations", "Capacity", "CheckIns", "Feedbacks", "Paid"])

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analytics-${orgId.slice(0, 8)}.csv"`,
    },
  })
}

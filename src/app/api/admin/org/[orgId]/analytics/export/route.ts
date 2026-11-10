import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { csvResponse, exportDateStamp, toCsv } from "@/lib/csv-export"

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

  // event titles are typed by organizers: toCsv neutralises spreadsheet formulas
  const headers = ["Event", "Date", "Status", "Registrations", "Capacity", "CheckIns", "Feedbacks", "Paid"]
  const rows = events.map((e) => [
    e.title,
    e.startDate.toISOString().slice(0, 10),
    e.status,
    e.currentRegistrations,
    e.maxCapacity ?? "Unlimited",
    e._count.checkIns,
    e._count.feedbacks,
    e.isPaid ? "Yes" : "No",
  ])

  return csvResponse(`analytics-${exportDateStamp()}.csv`, toCsv(headers, rows))
}

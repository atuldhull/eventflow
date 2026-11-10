import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { EventStatus, Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { cleanSearch, enterpriseEventScope, parsePaging } from "@/lib/enterprise-admin"
import { readApprovalDecision } from "@/lib/enterprise-event-approval"

const EVENT_STATUSES: readonly EventStatus[] = [
  "DRAFT", "PENDING_APPROVAL", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED", "POSTPONED",
]

/**
 * Every event of the enterprise (its own and its organizations'). `status` filters to one
 * EventStatus (an unknown one is a 400); `counts` are totals over ALL the enterprise's
 * events, whatever the page, search or filter, for the KPI strip and the tab badges.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { enterpriseId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_VIEW, { enterpriseId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const { page, limit, skip } = parsePaging(searchParams, 10)
  const search = cleanSearch(searchParams.get("search"))
  const rawStatus = searchParams.get("status") || ""
  const status = EVENT_STATUSES.find((s) => s === rawStatus.toUpperCase())
  if (rawStatus && !status) {
    return NextResponse.json({ success: false, message: `Unknown status "${rawStatus}"` }, { status: 400 })
  }

  const scope = enterpriseEventScope(enterpriseId)
  const where: Prisma.EventWhereInput = {
    ...scope,
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    ...(status ? { status } : {}),
  }

  const [events, total, byStatus] = await Promise.all([
    prisma.event.findMany({
      where,
      // the oldest request first while reviewing; newest first otherwise
      orderBy: { createdAt: status === "PENDING_APPROVAL" ? "asc" : "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        status: true,
        type: true,
        startDate: true,
        endDate: true,
        currentRegistrations: true,
        maxCapacity: true,
        isPaid: true,
        isFeatured: true,
        settings: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.event.count({ where }),
    prisma.event.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
  ])

  const count = (...s: EventStatus[]) => byStatus.filter((g) => s.includes(g.status)).reduce((n, g) => n + g._count._all, 0)
  const counts = {
    total: byStatus.reduce((n, g) => n + g._count._all, 0),
    pending: count("PENDING_APPROVAL"),
    published: count("PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"),
    ongoing: count("ONGOING"),
    completed: count("COMPLETED"),
    draft: count("DRAFT"),
  }

  return NextResponse.json({
    success: true,
    data: events.map(({ settings, ...e }) => {
      const decision = readApprovalDecision(settings)
      return {
        ...e,
        organization: e.organization?.name || "Direct",
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        // the enterprise's last approval decision (a rejection's reason is shown to the org)
        approvalDecision: decision ? { status: decision.status, reason: decision.reason, decidedAt: decision.decidedAt } : null,
      }
    }),
    counts,
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}

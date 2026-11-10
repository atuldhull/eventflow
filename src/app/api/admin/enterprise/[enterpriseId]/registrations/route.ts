import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { cleanSearch, enterpriseRegistrationWhere, parsePaging } from "@/lib/enterprise-admin"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { enterpriseId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.REGISTRATION_VIEW, { enterpriseId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const sp = request.nextUrl.searchParams
  const { page, limit, skip } = parsePaging(sp, 20)
  const search = cleanSearch(sp.get("search"))

  // KPIs describe the whole enterprise; only the list narrows with the search.
  const scope = enterpriseRegistrationWhere(enterpriseId)
  const where = enterpriseRegistrationWhere(enterpriseId, search)

  const [registrations, total, statsAll] = await Promise.all([
    prisma.registration.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, select: { id: true, registrationNumber: true, status: true, createdAt: true, user: { select: { name: true, email: true } }, event: { select: { title: true, organization: { select: { name: true } } } }, ticketType: { select: { name: true, price: true } } } }),
    prisma.registration.count({ where }),
    Promise.all([
      prisma.registration.count({ where: scope }),
      prisma.registration.count({ where: { ...scope, status: "CONFIRMED" } }),
      prisma.registration.count({ where: { ...scope, status: "PENDING" } }),
      prisma.registration.count({ where: { ...scope, status: "CHECKED_IN" } }),
    ]),
  ])

  return NextResponse.json({
    success: true,
    data: registrations.map((r) => ({ id: r.id, registrationNumber: r.registrationNumber, participantName: r.user.name || "—", participantEmail: r.user.email, eventTitle: r.event.title, organization: r.event.organization?.name || "Direct", status: r.status, ticketType: r.ticketType?.name || "General", amount: r.ticketType ? Number(r.ticketType.price) : 0, createdAt: r.createdAt.toISOString() })),
    stats: { total: statsAll[0], confirmed: statsAll[1], pending: statsAll[2], checkedIn: statsAll[3] },
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}

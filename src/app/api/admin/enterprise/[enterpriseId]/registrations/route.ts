import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

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
  const page = parseInt(sp.get("page") || "1")
  const limit = parseInt(sp.get("limit") || "20")
  const search = sp.get("search") || ""

  const where: any = { event: { deletedAt: null, OR: [{ enterpriseId }, { organization: { enterpriseId } }] } }
  if (search) where.OR = [{ registrationNumber: { contains: search, mode: "insensitive" } }, { user: { name: { contains: search, mode: "insensitive" } } }, { user: { email: { contains: search, mode: "insensitive" } } }]

  const [registrations, total, statsAll] = await Promise.all([
    prisma.registration.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, select: { id: true, registrationNumber: true, status: true, createdAt: true, user: { select: { name: true, email: true } }, event: { select: { title: true, organization: { select: { name: true } } } }, ticketType: { select: { name: true, price: true } } } }),
    prisma.registration.count({ where }),
    Promise.all([
      prisma.registration.count({ where: { event: { deletedAt: null, OR: [{ enterpriseId }, { organization: { enterpriseId } }] } } }),
      prisma.registration.count({ where: { status: "CONFIRMED", event: { deletedAt: null, OR: [{ enterpriseId }, { organization: { enterpriseId } }] } } }),
      prisma.registration.count({ where: { status: "PENDING", event: { deletedAt: null, OR: [{ enterpriseId }, { organization: { enterpriseId } }] } } }),
      prisma.registration.count({ where: { status: "CHECKED_IN", event: { deletedAt: null, OR: [{ enterpriseId }, { organization: { enterpriseId } }] } } }),
    ]),
  ])

  return NextResponse.json({
    success: true,
    data: registrations.map((r) => ({ id: r.id, registrationNumber: r.registrationNumber, participantName: r.user.name || "—", participantEmail: r.user.email, eventTitle: r.event.title, organization: r.event.organization?.name || "Direct", status: r.status, ticketType: r.ticketType?.name || "General", amount: r.ticketType ? Number(r.ticketType.price) : 0, createdAt: r.createdAt.toISOString() })),
    stats: { total: statsAll[0], confirmed: statsAll[1], pending: statsAll[2], checkedIn: statsAll[3] },
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}

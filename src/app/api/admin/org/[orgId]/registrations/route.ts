import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.REGISTRATION_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const search = searchParams.get("search") || ""
  const status = searchParams.get("status") || ""

  const where: Record<string, unknown> = { event: { organizationId: orgId, deletedAt: null } }
  if (search) {
    where.OR = [
      { registrationNumber: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ]
  }
  if (status) where.status = status

  const [registrations, total, stats] = await Promise.all([
    prisma.registration.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, registrationNumber: true, status: true, createdAt: true,
        user: { select: { name: true, email: true } },
        event: { select: { title: true, slug: true } },
        ticketType: { select: { name: true, price: true } },
      },
    }),
    prisma.registration.count({ where: where as any }),
    Promise.all([
      prisma.registration.count({ where: { event: { organizationId: orgId, deletedAt: null } } }),
      prisma.registration.count({ where: { event: { organizationId: orgId, deletedAt: null }, status: "CONFIRMED" } }),
      prisma.registration.count({ where: { event: { organizationId: orgId, deletedAt: null }, status: "PENDING" } }),
      prisma.registration.count({ where: { event: { organizationId: orgId, deletedAt: null }, status: "CHECKED_IN" } }),
    ]),
  ])

  return NextResponse.json({
    success: true,
    data: registrations.map((r) => ({
      id: r.id,
      registrationNumber: r.registrationNumber,
      participantName: r.user.name || "—",
      participantEmail: r.user.email,
      eventTitle: r.event.title,
      status: r.status,
      ticketType: r.ticketType?.name || "General",
      amount: r.ticketType ? Number(r.ticketType.price) : 0,
      createdAt: r.createdAt.toISOString(),
    })),
    stats: { total: stats[0], confirmed: stats[1], pending: stats[2], checkedIn: stats[3] },
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}

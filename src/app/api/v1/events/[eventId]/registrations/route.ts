import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withApiAuth } from "@/lib/api-auth"
import prisma from "@/lib/prisma"

export const GET = withApiAuth("registrations:read", async (req, ctx, routeCtx) => {
  const { eventId } = await routeCtx.params
  const searchParams = req.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
  const status = searchParams.get("status") || ""

  const where: Record<string, unknown> = { eventId }
  if (status) where.status = status

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, registrationNumber: true, status: true, type: true, createdAt: true,
        user: { select: { name: true, email: true, phone: true } },
        ticketType: { select: { name: true, price: true } },
        checkIn: { select: { checkedInAt: true } },
      },
    }),
    prisma.registration.count({ where: where as any }),
  ])

  return NextResponse.json({
    data: registrations.map((r) => ({
      id: r.id, registrationNumber: r.registrationNumber, status: r.status, type: r.type,
      participant: { name: r.user.name, email: r.user.email, phone: r.user.phone },
      ticketType: { name: r.ticketType.name, price: Number(r.ticketType.price) },
      checkedIn: !!r.checkIn, checkedInAt: r.checkIn?.checkedInAt?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
  })
})

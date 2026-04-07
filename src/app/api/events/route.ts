import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "12")
  const search = searchParams.get("search") || ""
  const category = searchParams.get("category") || ""
  const pricing = searchParams.get("pricing") || ""

  const where: Record<string, unknown> = {
    deletedAt: null,
    status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING", "COMPLETED"] },
    visibility: { in: ["PUBLIC", "UNLISTED"] },
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { tags: { has: search } },
    ]
  }
  if (category && category !== "All") where.category = category
  if (pricing === "free") where.isPaid = false
  if (pricing === "paid") where.isPaid = true

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where: where as any,
      orderBy: { startDate: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, title: true, slug: true, shortDescription: true, coverImage: true,
        category: true, startDate: true, venue: true, venueCity: true, isOnline: true,
        isPaid: true, currentRegistrations: true, maxCapacity: true, status: true, isFeatured: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.event.count({ where: where as any }),
  ])

  return NextResponse.json({
    success: true,
    data: events.map((e) => ({ ...e, startDate: e.startDate.toISOString() })),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}

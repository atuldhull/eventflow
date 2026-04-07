import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withApiAuth } from "@/lib/api-auth"
import prisma from "@/lib/prisma"

export const GET = withApiAuth("events:read", async (req, ctx) => {
  const searchParams = req.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
  const status = searchParams.get("status") || ""
  const category = searchParams.get("category") || ""
  const search = searchParams.get("search") || ""
  const sort = searchParams.get("sort") || "created_at"
  const order = searchParams.get("order") || "desc"

  const where: Record<string, unknown> = { deletedAt: null }
  if (ctx.organizationId) where.organizationId = ctx.organizationId
  if (ctx.enterpriseId) where.OR = [{ enterpriseId: ctx.enterpriseId }, { organization: { enterpriseId: ctx.enterpriseId } }]
  if (status) where.status = status
  if (category) where.category = category
  if (search) where.title = { contains: search, mode: "insensitive" }

  const sortField = sort === "start_date" ? "startDate" : sort === "title" ? "title" : "createdAt"

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where: where as any,
      orderBy: { [sortField]: order },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, title: true, slug: true, shortDescription: true, status: true, type: true,
        category: true, visibility: true, startDate: true, endDate: true, venue: true, venueCity: true,
        isOnline: true, maxCapacity: true, currentRegistrations: true, isPaid: true, coverImage: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.event.count({ where: where as any }),
  ])

  return NextResponse.json({
    data: events.map((e) => ({ ...e, startDate: e.startDate.toISOString(), endDate: e.endDate.toISOString(), createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString() })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
  })
})

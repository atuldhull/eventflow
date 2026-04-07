import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"

export const GET = withSuperAdmin(async (req) => {
  const sp = req.nextUrl.searchParams
  const page = parseInt(sp.get("page") || "1")
  const limit = parseInt(sp.get("limit") || "20")
  const search = sp.get("search") || ""

  const where: any = { deletedAt: null }
  if (search) where.title = { contains: search, mode: "insensitive" }

  const [events, total] = await Promise.all([
    prisma.event.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, select: { id: true, title: true, slug: true, category: true, status: true, startDate: true, currentRegistrations: true, maxCapacity: true, isPaid: true, isFeatured: true, organization: { select: { name: true } }, enterprise: { select: { name: true } } } }),
    prisma.event.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: events.map(e => ({ ...e, organization: e.organization?.name || "—", enterprise: e.enterprise?.name || "—", startDate: e.startDate.toISOString() })),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
})

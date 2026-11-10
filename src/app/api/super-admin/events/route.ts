import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { cleanSearch, parsePaging } from "@/lib/enterprise-admin"

const ACTIVE_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"] as const

export const GET = withSuperAdmin(async (req) => {
  const sp = req.nextUrl.searchParams
  const { page, limit, skip } = parsePaging(sp, 20)
  const search = cleanSearch(sp.get("search"))

  const base: Prisma.EventWhereInput = { deletedAt: null }
  const where: Prisma.EventWhereInput = search ? { ...base, title: { contains: search, mode: "insensitive" } } : base

  // KPIs are platform-wide totals, not counts of the page on screen.
  const [events, total, allEvents, active, completed] = await Promise.all([
    prisma.event.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, select: { id: true, title: true, slug: true, category: true, status: true, startDate: true, currentRegistrations: true, maxCapacity: true, isPaid: true, isFeatured: true, organization: { select: { name: true } }, enterprise: { select: { name: true } } } }),
    prisma.event.count({ where }),
    prisma.event.count({ where: base }),
    prisma.event.count({ where: { ...base, status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.event.count({ where: { ...base, status: "COMPLETED" } }),
  ])

  return NextResponse.json({
    success: true,
    data: events.map(e => ({ ...e, organization: e.organization?.name || "—", enterprise: e.enterprise?.name || "—", startDate: e.startDate.toISOString() })),
    stats: { total: allEvents, active, completed },
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
})

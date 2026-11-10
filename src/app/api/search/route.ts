import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { liveWorkspaceWhere } from "@/lib/public-events"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || ""

  if (!query || query.length < 2) {
    return NextResponse.json({ success: true, data: { events: [], organizations: [] } })
  }

  const [events, organizations] = await Promise.all([
    prisma.event.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"] },
        visibility: "PUBLIC", // UNLISTED = reachable by link, never listed or searchable
        ...liveWorkspaceWhere(),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { tags: { has: query } },
        ],
      },
      orderBy: { startDate: "asc" },
      take: 10,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        startDate: true,
        coverImage: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.organization.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        // nor an organization of a deactivated or deleted enterprise
        AND: [{ OR: [{ enterpriseId: null }, { enterprise: { isActive: true, deletedAt: null } }] }],
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        category: true,
        _count: { select: { events: true } },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      events: events.map((e) => ({ ...e, startDate: e.startDate.toISOString() })),
      organizations: organizations.map((o) => ({ ...o, eventCount: o._count.events })),
    },
  })
}

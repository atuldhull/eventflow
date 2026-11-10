import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import {
  PUBLIC_EVENT_CARD_SELECT,
  buildPublicEventsWhere,
  publicEventsOrderBy,
  publicEventsQuerySchema,
  serializeEventCard,
} from "@/lib/public-events"

/**
 * The public event listing (/events, the landing page, tenant-site sections). Only
 * PUBLIC events in a listed status appear; UNLISTED ones are reachable by link only.
 */
export async function GET(request: NextRequest) {
  const parsed = publicEventsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid query", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const query = parsed.data
  const page = query.page
  // A month view (dateFrom/dateTo) wants the whole month, not the first 12
  const limit = query.limit ?? (query.dateFrom || query.dateTo ? 50 : 12)
  const where = buildPublicEventsWhere(query)

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: publicEventsOrderBy(query),
      skip: (page - 1) * limit,
      take: limit,
      select: PUBLIC_EVENT_CARD_SELECT,
    }),
    prisma.event.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: events.map((e) => serializeEventCard(e)),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}

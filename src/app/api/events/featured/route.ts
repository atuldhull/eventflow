import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { PUBLIC_EVENT_CARD_SELECT, UPCOMING_EVENT_STATUSES, publicListingWhere, serializeEventCard } from "@/lib/public-events"

/** Featured upcoming events for the landing page: PUBLIC only, like every listing. */
export async function GET() {
  const events = await prisma.event.findMany({
    where: {
      ...publicListingWhere(UPCOMING_EVENT_STATUSES),
      isFeatured: true,
      startDate: { gte: new Date() },
    },
    orderBy: { startDate: "asc" },
    take: 6,
    // includes the visible ticket prices, summarised as `price` by serializeEventCard
    select: PUBLIC_EVENT_CARD_SELECT,
  })

  return NextResponse.json({
    success: true,
    data: events.map((e) => {
      const card = serializeEventCard(e)
      return { ...card, minPrice: card.price?.min ?? 0 }
    }),
  })
}

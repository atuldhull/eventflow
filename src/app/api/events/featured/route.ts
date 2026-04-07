import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  const events = await prisma.event.findMany({
    where: {
      isFeatured: true,
      deletedAt: null,
      status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"] },
      visibility: { in: ["PUBLIC", "UNLISTED"] },
      startDate: { gte: new Date() },
    },
    orderBy: { startDate: "asc" },
    take: 6,
    select: {
      id: true, title: true, slug: true, shortDescription: true, coverImage: true,
      category: true, startDate: true, venue: true, venueCity: true, isOnline: true,
      isPaid: true, currentRegistrations: true, maxCapacity: true, status: true, isFeatured: true,
      organization: { select: { name: true } },
      ticketTypes: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        take: 1,
        select: { price: true },
      },
    },
  })

  return NextResponse.json({
    success: true,
    data: events.map((e) => ({
      ...e,
      startDate: e.startDate.toISOString(),
      minPrice: e.ticketTypes[0]?.price || 0,
    })),
  })
}

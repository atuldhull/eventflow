import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      shortDescription: true,
      status: true,
      type: true,
      visibility: true,
      category: true,
      tags: true,
      startDate: true,
      endDate: true,
      timezone: true,
      registrationStartDate: true,
      registrationEndDate: true,
      venue: true,
      venueAddress: true,
      venueCity: true,
      venueState: true,
      venueCountry: true,
      isOnline: true,
      onlinePlatform: true,
      coverImage: true,
      thumbnailImage: true,
      gallery: true,
      maxCapacity: true,
      currentRegistrations: true,
      waitlistEnabled: true,
      approvalRequired: true,
      allowTeamRegistration: true,
      minTeamSize: true,
      maxTeamSize: true,
      isPaid: true,
      rules: true,
      termsAndConditions: true,
      refundPolicy: true,
      contactEmail: true,
      contactPhone: true,
      isFeatured: true,
      seoTitle: true,
      seoDescription: true,
      organization: {
        select: { id: true, name: true, logo: true, description: true, slug: true },
      },
      ticketTypes: {
        where: { isActive: true, isHidden: false },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, name: true, description: true, price: true, currency: true,
          quantity: true, sold: true, maxPerUser: true, saleStartDate: true, saleEndDate: true,
        },
      },
      sessions: {
        orderBy: { startTime: "asc" },
        select: {
          id: true, title: true, description: true, speaker: true, speakerBio: true,
          speakerAvatar: true, startTime: true, endTime: true, venue: true, track: true,
        },
      },
      sponsors: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, logo: true, website: true, tier: true } },
      faqs: { where: { isPublished: true }, orderBy: { sortOrder: "asc" }, select: { id: true, question: true, answer: true } },
    },
  })

  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  // Only show published/open/ongoing/completed events publicly
  const publicStatuses = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"]
  if (!publicStatuses.includes(event.status) && event.visibility !== "UNLISTED") {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: event })
}

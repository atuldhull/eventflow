import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const session = await auth()

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

  // Show cancelled events with notice, hide drafts
  if (event.status === "CANCELLED") {
    return NextResponse.json({ success: true, data: event, cancelled: true })
  }

  const publicStatuses = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"]
  if (!publicStatuses.includes(event.status)) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  // PRIVATE and INVITE_ONLY events: return limited info to unauthenticated users
  if (event.visibility === "PRIVATE" || event.visibility === "INVITE_ONLY") {
    // Check if request has auth (via cookie-based session — not available in route handler without auth())
    // For API routes, we return minimal info so the page can show "Private Event" messaging
    return NextResponse.json({
      success: true,
      data: {
        ...event,
        // Strip sensitive details for private events accessed publicly
        description: null,
        onlinePlatform: null,
        contactEmail: null,
        contactPhone: null,
        rules: null,
        termsAndConditions: null,
        refundPolicy: null,
        gallery: [],
      },
      isPrivate: true,
    })
  }

  // If the viewer is signed in, surface their existing registration for this event (if any)
  let myRegistration: { id: string; status: string; registrationNumber: string } | null = null
  if (session?.user?.id) {
    const reg = await prisma.registration.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
      select: { id: true, status: true, registrationNumber: true },
    })
    if (reg) myRegistration = reg
  }

  // Hide meeting link from public view — only show after registration
  return NextResponse.json({
    success: true,
    data: {
      ...event,
      onlineLink: null, // Hidden until registered
      onlinePassword: null,
      myRegistration,
    },
  })
}

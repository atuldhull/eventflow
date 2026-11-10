import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { registrationFieldsFromSettings } from "@/lib/event-update"
import { liveWorkspaceWhere } from "@/lib/public-events"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const event = await prisma.event.findFirst({
    where: { slug, deletedAt: null, ...liveWorkspaceWhere() },
    select: {
      id: true,
      title: true,
      slug: true,
      startDate: true,
      endDate: true,
      timezone: true,
      venue: true,
      venueAddress: true,
      venueCity: true,
      isOnline: true,
      onlinePlatform: true,
      contactEmail: true,
      approvalRequired: true,
      allowTeamRegistration: true,
      minTeamSize: true,
      maxTeamSize: true,
      termsAndConditions: true,
      isPaid: true,
      settings: true,
      ticketTypes: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, name: true, description: true, price: true, currency: true,
          quantity: true, sold: true, maxPerUser: true, isHidden: true,
          saleStartDate: true, saleEndDate: true,
        },
      },
      customFormFields: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, label: true, fieldType: true, placeholder: true,
          helpText: true, isRequired: true, options: true, validation: true,
        },
      },
    },
  })

  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    data: {
      eventId: event.id,
      title: event.title,
      slug: event.slug,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      timezone: event.timezone,
      venue: event.venue,
      venueAddress: event.venueAddress,
      venueCity: event.venueCity,
      isOnline: event.isOnline,
      onlinePlatform: event.onlinePlatform,
      contactEmail: event.contactEmail,
      approvalRequired: event.approvalRequired,
      termsAndConditions: event.termsAndConditions,
      isPaid: event.isPaid,
      // Which optional default fields the form asks for (set in the event wizard, step 4):
      // { phone, organization, department }. Name and email are always asked.
      registrationFields: registrationFieldsFromSettings(event.settings),
      teamSettings: event.allowTeamRegistration
        ? { enabled: true, minSize: event.minTeamSize || 2, maxSize: event.maxTeamSize || 5 }
        : null,
      ticketTypes: event.ticketTypes.filter((t) => !t.isHidden).map((t) => ({
        ...t,
        price: Number(t.price),
        remaining: t.quantity ? t.quantity - t.sold : null,
        isSoldOut: t.quantity ? t.sold >= t.quantity : false,
      })),
      customFields: event.customFormFields,
    },
  })
}

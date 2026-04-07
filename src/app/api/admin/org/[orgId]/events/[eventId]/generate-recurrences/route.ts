import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

function addInterval(date: Date, pattern: string): Date {
  const d = new Date(date)
  switch (pattern) {
    case "DAILY": d.setDate(d.getDate() + 1); break
    case "WEEKLY": d.setDate(d.getDate() + 7); break
    case "BIWEEKLY": d.setDate(d.getDate() + 14); break
    case "MONTHLY": d.setMonth(d.getMonth() + 1); break
    case "QUARTERLY": d.setMonth(d.getMonth() + 3); break
    default: d.setDate(d.getDate() + 7)
  }
  return d
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })

  const { orgId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_CREATE, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const parent = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId },
    select: {
      id: true, title: true, slug: true, description: true, shortDescription: true,
      type: true, visibility: true, category: true, tags: true, timezone: true,
      startDate: true, endDate: true, venue: true, venueAddress: true, venueCity: true,
      venueState: true, venueCountry: true, isOnline: true, onlinePlatform: true,
      onlineLink: true, maxCapacity: true, isPaid: true, approvalRequired: true,
      waitlistEnabled: true, allowTeamRegistration: true, minTeamSize: true, maxTeamSize: true,
      contactEmail: true, contactPhone: true, organizationId: true, enterpriseId: true,
      settings: true, createdById: true,
    },
  })

  if (!parent) return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })

  const settings = parent.settings as any || {}
  const pattern = settings.recurrencePattern || "WEEKLY"
  const count = settings.recurrenceCount || 4

  const duration = parent.endDate.getTime() - parent.startDate.getTime()
  const created: string[] = []

  for (let i = 1; i < count; i++) {
    let newStart = new Date(parent.startDate)
    for (let j = 0; j < i; j++) newStart = addInterval(newStart, pattern)
    const newEnd = new Date(newStart.getTime() + duration)

    let slug = `${parent.slug}-${i + 1}`
    while (await prisma.event.findUnique({ where: { slug } })) slug = `${parent.slug}-${i + 1}-${Date.now()}`

    const child = await prisma.event.create({
      data: {
        title: `${parent.title} (#${i + 1})`,
        slug,
        description: parent.description,
        shortDescription: parent.shortDescription,
        type: "SINGLE",
        visibility: parent.visibility,
        category: parent.category,
        tags: parent.tags,
        timezone: parent.timezone,
        startDate: newStart,
        endDate: newEnd,
        venue: parent.venue,
        venueAddress: parent.venueAddress,
        venueCity: parent.venueCity,
        venueState: parent.venueState,
        venueCountry: parent.venueCountry,
        isOnline: parent.isOnline,
        onlinePlatform: parent.onlinePlatform,
        onlineLink: parent.onlineLink,
        maxCapacity: parent.maxCapacity,
        isPaid: parent.isPaid,
        approvalRequired: parent.approvalRequired,
        waitlistEnabled: parent.waitlistEnabled,
        allowTeamRegistration: parent.allowTeamRegistration,
        minTeamSize: parent.minTeamSize,
        maxTeamSize: parent.maxTeamSize,
        contactEmail: parent.contactEmail,
        contactPhone: parent.contactPhone,
        organizationId: parent.organizationId,
        enterpriseId: parent.enterpriseId,
        createdById: parent.createdById,
        parentEventId: parent.id,
        status: "DRAFT",
        settings: parent.settings || undefined,
      },
    })
    created.push(child.id)
  }

  return NextResponse.json({
    success: true,
    message: `Created ${created.length} recurring instances`,
    data: { parentId: parent.id, childIds: created, count: created.length },
  })
}

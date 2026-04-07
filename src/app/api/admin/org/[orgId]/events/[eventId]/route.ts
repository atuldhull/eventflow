import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      customFormFields: { orderBy: { sortOrder: "asc" } },
      sessions: { orderBy: { startTime: "asc" } },
      sponsors: { orderBy: { sortOrder: "asc" } },
      faqs: { orderBy: { sortOrder: "asc" } },
      organization: { select: { name: true, logo: true } },
      createdBy: { select: { name: true } },
      _count: { select: { registrations: true, payments: true, checkIns: true } },
    },
  })

  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: event })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_EDIT, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { ticketTypes, customFormFields, sessions, sponsors, faqs, ...eventData } = body

    const event = await prisma.event.update({
      where: { id: eventId },
      data: eventData,
    })

    // Update nested relations if provided
    if (ticketTypes) {
      await prisma.ticketType.deleteMany({ where: { eventId } })
      if (ticketTypes.length > 0) {
        await prisma.ticketType.createMany({
          data: ticketTypes.map((tt: any, i: number) => ({
            eventId,
            name: tt.name,
            description: tt.description || null,
            price: tt.price || 0,
            currency: tt.currency || "INR",
            quantity: tt.quantity || null,
            maxPerUser: tt.maxPerUser || 1,
            isActive: tt.isActive ?? true,
            sortOrder: i,
          })),
        })
      }
    }

    if (customFormFields) {
      await prisma.customFormField.deleteMany({ where: { eventId } })
      if (customFormFields.length > 0) {
        await prisma.customFormField.createMany({
          data: customFormFields.map((f: any, i: number) => ({
            eventId,
            label: f.label,
            fieldType: f.fieldType,
            placeholder: f.placeholder || null,
            helpText: f.helpText || null,
            isRequired: f.isRequired || false,
            options: f.options || [],
            sortOrder: i,
          })),
        })
      }
    }

    if (sessions) {
      await prisma.eventSession.deleteMany({ where: { eventId } })
      if (sessions.length > 0) {
        await prisma.eventSession.createMany({
          data: sessions.map((s: any, i: number) => ({
            eventId,
            title: s.title,
            description: s.description || null,
            speaker: s.speaker || null,
            speakerBio: s.speakerBio || null,
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime),
            venue: s.venue || null,
            track: s.track || null,
            capacity: s.capacity || null,
            sortOrder: i,
          })),
        })
      }
    }

    if (sponsors) {
      await prisma.eventSponsor.deleteMany({ where: { eventId } })
      if (sponsors.length > 0) {
        await prisma.eventSponsor.createMany({
          data: sponsors.map((sp: any, i: number) => ({
            eventId,
            name: sp.name,
            logo: sp.logo || null,
            website: sp.website || null,
            tier: sp.tier,
            sortOrder: i,
          })),
        })
      }
    }

    if (faqs) {
      await prisma.eventFAQ.deleteMany({ where: { eventId } })
      if (faqs.length > 0) {
        await prisma.eventFAQ.createMany({
          data: faqs.map((f: any, i: number) => ({
            eventId,
            question: f.question,
            answer: f.answer,
            sortOrder: i,
          })),
        })
      }
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "EVENT",
      entityId: eventId,
      description: `Updated event: ${event.title}`,
      ipAddress,
      userAgent,
      organizationId: orgId,
    })

    return NextResponse.json({ success: true, data: event })
  } catch (error) {
    console.error("Update event error:", error)
    return NextResponse.json({ success: false, message: "Failed to update event" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_DELETE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId },
    select: { status: true, title: true, currentRegistrations: true },
  })

  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  if (event.currentRegistrations > 0) {
    return NextResponse.json(
      { success: false, message: "Cannot delete event with existing registrations. Cancel the event instead." },
      { status: 400 }
    )
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { deletedAt: new Date() },
  })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    entityType: "EVENT",
    entityId: eventId,
    description: `Deleted event: ${event.title}`,
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  return NextResponse.json({ success: true, message: "Event deleted" })
}

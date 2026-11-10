import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import {
  PAID_TICKET_WHERE,
  PENDING_APPROVAL_MESSAGE,
  notifyEventApprovers,
  paidTicketsBlocker,
  publishOutcome,
} from "@/lib/event-publishing"
import { eventScheduleIssues } from "@/lib/validations/event"
import { approvalRejection } from "@/lib/enterprise-event-approval"
import { PERMISSIONS, getRolePermissions } from "@/lib/permissions"
import {
  TicketQuantityError,
  eventColumns,
  eventUpdateSchema,
  mergeEventSettings,
  registrationFieldsFromSettings,
  syncTicketTypes,
} from "@/lib/event-update"

/** A publish that the event's state doesn't allow (rolled back with the rest of the update). */
class PublishError extends Error {}

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
      organization: { select: { name: true, logo: true, enterprise: { select: { name: true } } } },
      createdBy: { select: { name: true } },
      _count: { select: { registrations: true, payments: true, checkIns: true } },
    },
  })

  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  // Revenue (completed payments, net of refunds) only for people who may see payments.
  const canSeeRevenue = !!authResult.role && getRolePermissions(authResult.role).includes(PERMISSIONS.PAYMENT_VIEW)
  let revenue: number | null = null
  if (canSeeRevenue) {
    const sums = await prisma.payment.aggregate({
      where: { eventId, status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] } },
      _sum: { amount: true, refundAmount: true },
    })
    revenue = Number(sums._sum.amount ?? 0) - Number(sums._sum.refundAmount ?? 0)
  }

  // set while an event the enterprise rejected is still the draft it was sent back as
  const rejection = approvalRejection(event)

  return NextResponse.json({
    success: true,
    data: {
      ...event,
      revenue,
      registrationFields: registrationFieldsFromSettings(event.settings),
      approvalRejection: rejection && { ...rejection, enterpriseName: event.organization?.enterprise?.name ?? null },
    },
  })
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

  const parsed = eventUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]
          ? `${parsed.error.issues[0].path.join(".") || "Body"}: ${parsed.error.issues[0].message}`
          : "Validation failed",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 }
    )
  }
  const input = parsed.data

  // Only this organization's events: another tenant's event id is "not found".
  const current = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    select: {
      id: true, title: true, status: true, slug: true, startDate: true, endDate: true, settings: true,
      registrationStartDate: true, registrationEndDate: true, enterpriseId: true,
    },
  })
  if (!current) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  // The schedule after this update (unchanged fields keep their stored value; null clears).
  const scheduleIssue = eventScheduleIssues({
    startDate: input.startDate ?? current.startDate,
    endDate: input.endDate ?? current.endDate,
    registrationStartDate: input.registrationStartDate === undefined ? current.registrationStartDate : input.registrationStartDate,
    registrationEndDate: input.registrationEndDate === undefined ? current.registrationEndDate : input.registrationEndDate,
  })[0]
  if (scheduleIssue) {
    return NextResponse.json({ success: false, message: `${scheduleIssue.message}.`, errors: { [scheduleIssue.path]: [scheduleIssue.message] } }, { status: 400 })
  }

  if (input.slug && input.slug !== current.slug) {
    const taken = await prisma.event.findUnique({ where: { slug: input.slug }, select: { id: true } })
    if (taken && taken.id !== eventId) {
      return NextResponse.json({ success: false, message: "Another event already uses this URL. Choose a different slug." }, { status: 409 })
    }
  }

  // Publishing from the wizard follows the publish route's rules. A "draft" save never
  // takes a live event back to draft.
  const publish = input.status === "PUBLISHED" && current.status === "DRAFT"
  if (publish) {
    const perms = authResult.role ? getRolePermissions(authResult.role) : []
    if (!perms.includes(PERMISSIONS.EVENT_PUBLISH)) {
      return NextResponse.json({ success: false, message: "You don't have permission to publish events." }, { status: 403 })
    }
  }
  // An enterprise that requires approval gets the event as PENDING_APPROVAL instead
  const outcome = publish ? await publishOutcome(orgId, session.user.id) : null
  const awaitingApproval = outcome?.status === "PENDING_APPROVAL"
  // Set while online payments are unavailable: publishing then needs every ticket free.
  const paymentsBlocker = publish ? await paidTicketsBlocker() : null

  try {
    const event = await prisma.$transaction(async (tx) => {
      if (input.ticketTypes) await syncTicketTypes(tx, eventId, input.ticketTypes)
      if (publish && (await tx.ticketType.count({ where: { eventId, isActive: true } })) === 0) {
        throw new PublishError("Event must have at least one ticket type")
      }
      if (paymentsBlocker && (await tx.ticketType.count({ where: { eventId, ...PAID_TICKET_WHERE } })) > 0) {
        throw new PublishError(paymentsBlocker)
      }

      if (input.customFormFields) {
        await tx.customFormField.deleteMany({ where: { eventId } })
        if (input.customFormFields.length > 0) {
          await tx.customFormField.createMany({
            data: input.customFormFields.map((f, i) => ({
              eventId,
              label: f.label,
              fieldType: f.fieldType,
              placeholder: f.placeholder || null,
              helpText: f.helpText || null,
              isRequired: f.isRequired || false,
              options: f.options || [],
              ...(f.validation ? { validation: f.validation as object } : {}),
              sortOrder: i,
            })),
          })
        }
      }

      if (input.sessions) {
        await tx.eventSession.deleteMany({ where: { eventId } })
        if (input.sessions.length > 0) {
          await tx.eventSession.createMany({
            data: input.sessions.map((s, i) => ({
              eventId,
              title: s.title,
              description: s.description || null,
              speaker: s.speaker || null,
              speakerBio: s.speakerBio || null,
              speakerAvatar: s.speakerAvatar || null,
              startTime: s.startTime,
              endTime: s.endTime,
              venue: s.venue || null,
              track: s.track || null,
              capacity: s.capacity ?? null,
              sortOrder: i,
            })),
          })
        }
      }

      if (input.sponsors) {
        await tx.eventSponsor.deleteMany({ where: { eventId } })
        if (input.sponsors.length > 0) {
          await tx.eventSponsor.createMany({
            data: input.sponsors.map((sp, i) => ({
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

      if (input.faqs) {
        await tx.eventFAQ.deleteMany({ where: { eventId } })
        if (input.faqs.length > 0) {
          await tx.eventFAQ.createMany({
            data: input.faqs.map((f, i) => ({ eventId, question: f.question, answer: f.answer, sortOrder: i })),
          })
        }
      }

      return tx.event.update({
        where: { id: eventId },
        data: {
          ...eventColumns(input),
          ...(input.settings ? { settings: mergeEventSettings(current.settings, input.settings) } : {}),
          ...(publish ? (awaitingApproval ? { status: "PENDING_APPROVAL" as const } : { status: "PUBLISHED" as const, publishedAt: new Date() }) : {}),
        },
      })
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: publish && !awaitingApproval ? "PUBLISH" : "UPDATE",
      entityType: "EVENT",
      entityId: eventId,
      description: `${publish ? (awaitingApproval ? "Submitted for approval" : "Published") : "Updated"} event: ${event.title}`,
      ipAddress,
      userAgent,
      eventId,
      organizationId: orgId,
      enterpriseId: current.enterpriseId ?? outcome?.enterpriseId ?? undefined,
    })

    if (awaitingApproval && outcome?.enterpriseId) {
      await notifyEventApprovers(outcome.enterpriseId, { id: eventId, title: event.title }, session.user.id)
    }
    return NextResponse.json({
      success: true,
      message: publish ? (awaitingApproval ? PENDING_APPROVAL_MESSAGE : "Event published") : "Event updated",
      data: event,
    })
  } catch (error) {
    if (error instanceof TicketQuantityError || error instanceof PublishError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }
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
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    select: { status: true, title: true, currentRegistrations: true, _count: { select: { registrations: true } } },
  })

  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  if (event.currentRegistrations > 0 || event._count.registrations > 0) {
    return NextResponse.json(
      { success: false, message: "Cannot delete event with existing registrations. Cancel the event instead." },
      { status: 400 }
    )
  }

  await prisma.event.updateMany({
    where: { id: eventId, organizationId: orgId },
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

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import type { EventStatus, Prisma } from "@prisma/client"
import { z } from "zod/v4"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS, getRolePermissions } from "@/lib/permissions"
import { createFullEventSchema, eventScheduleIssues } from "@/lib/validations/event"
import { imageUrlSchema, mergeEventSettings, wizardSettingsSchema } from "@/lib/event-update"
import {
  PENDING_APPROVAL_MESSAGE,
  enterpriseRequiresEventApproval,
  notifyEventApprovers,
  paidTicketsBlocker,
  publishOutcome,
} from "@/lib/event-publishing"
import { checkEventLimit } from "@/lib/subscription"
import { approvalRejection } from "@/lib/enterprise-event-approval"

const EVENT_STATUSES = [
  "DRAFT", "PENDING_APPROVAL", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED",
  "ONGOING", "COMPLETED", "CANCELLED", "POSTPONED",
] as const

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(10),
  search: z.string().trim().max(100).catch(""),
  /** One status or a comma-separated list. */
  status: z.string().max(200).optional().catch(undefined),
  category: z.string().trim().max(50).optional().catch(undefined),
  from: z.coerce.date().optional().catch(undefined),
  to: z.coerce.date().optional().catch(undefined),
  sort: z.enum(["created", "start"]).optional().catch(undefined),
})

// The wizard's settings (registration form fields, budget, add-ons...) and a checked cover
// image URL on top of the shared create schema, which would otherwise drop `settings`.
const createEventSchema = createFullEventSchema
  .extend({
    coverImage: imageUrlSchema.optional(),
    settings: wizardSettingsSchema.optional(),
  })
  // Ends after it starts; registration closes by the end (the wizard checks the same rules).
  .superRefine((d, ctx) => {
    for (const issue of eventScheduleIssues(d)) ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message })
  })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const q = listQuerySchema.parse({
    page: sp.get("page") ?? undefined,
    limit: sp.get("limit") ?? undefined,
    search: sp.get("search") ?? undefined,
    status: sp.get("status") || undefined,
    category: sp.get("category") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    sort: sp.get("sort") || undefined,
  })
  const statuses = q.status?.split(",").filter((s): s is EventStatus => (EVENT_STATUSES as readonly string[]).includes(s)) ?? []

  const scope: Prisma.EventWhereInput = { organizationId: orgId, deletedAt: null }
  const where: Prisma.EventWhereInput = {
    ...scope,
    ...(q.search ? { title: { contains: q.search, mode: "insensitive" } } : {}),
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(q.category ? { category: q.category } : {}),
    // from/to: events that overlap the window (still running at `from`, started by `to`).
    ...(q.from ? { endDate: { gte: q.from } } : {}),
    ...(q.to ? { startDate: { lte: q.to } } : {}),
  }

  const [events, total, byStatus, org] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: q.sort === "start" ? { startDate: "asc" } : { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        id: true, title: true, slug: true, category: true, status: true, type: true,
        visibility: true, startDate: true, endDate: true, timezone: true, currentRegistrations: true,
        maxCapacity: true, isPaid: true, isFeatured: true, coverImage: true, venue: true, isOnline: true,
        // read for the enterprise's reject reason only; not sent to the browser
        settings: true, createdAt: true,
      },
    }),
    prisma.event.count({ where }),
    prisma.event.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { enterprise: { select: { name: true, settings: true } } } }),
  ])

  // Counts across all of the organization's events (not just this page).
  const count = (...s: string[]) => byStatus.filter((b) => s.includes(b.status)).reduce((n, b) => n + b._count, 0)

  const enterpriseName = org?.enterprise?.name ?? null

  return NextResponse.json({
    success: true,
    data: events.map(({ settings, createdAt, ...e }) => {
      // set while an event the enterprise rejected is still the draft it was sent back as
      const rejection = approvalRejection({ status: e.status, settings, createdAt })
      return {
        ...e,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        approvalRejection: rejection && { ...rejection, enterpriseName },
      }
    }),
    // Whether the enterprise sends this organization's events through approval before they go live.
    approvalRequired: enterpriseRequiresEventApproval(org?.enterprise?.settings),
    stats: {
      total: byStatus.reduce((n, b) => n + b._count, 0),
      draft: count("DRAFT"),
      pendingApproval: count("PENDING_APPROVAL"),
      published: count("PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"),
      ongoing: count("ONGOING"),
      completed: count("COMPLETED"),
      cancelled: count("CANCELLED"),
    },
    pagination: { page: q.page, pageSize: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_CREATE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  try {
    // Plan limit: events created this month at the plan's level (the enterprise's, for an enterprise org)
    const limit = await checkEventLimit(orgId)
    if (!limit.allowed) {
      return NextResponse.json({ success: false, message: limit.message, data: { used: limit.used, limit: limit.limit, plan: limit.plan } }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const parsed = createEventSchema.safeParse(body)

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        {
          success: false,
          message: !issue
            ? "Validation failed"
            : issue.code === "custom"
              ? issue.message
              : `Validation failed: ${issue.path.join(".") || "body"}: ${issue.message}`,
          errors: z.flattenError(parsed.error).fieldErrors,
        },
        { status: 400 }
      )
    }

    const data = parsed.data
    const {
      ticketTypes, customFormFields, sessions, sponsors, faqs,
      status: eventStatus, isPaid, settings, parentEventId,
      ...eventData
    } = data

    if (eventStatus === "PUBLISHED" && !(authResult.role && getRolePermissions(authResult.role).includes(PERMISSIONS.EVENT_PUBLISH))) {
      return NextResponse.json({ success: false, message: "You don't have permission to publish events." }, { status: 403 })
    }

    // Paid tickets can't go live while online payments are unavailable.
    if (eventStatus === "PUBLISHED" && ticketTypes.some((tt) => (tt.isActive ?? true) && tt.price > 0)) {
      const blocker = await paidTicketsBlocker()
      if (blocker) return NextResponse.json({ success: false, message: blocker }, { status: 409 })
    }

    // A parent event must be one of this organization's events.
    const parent = parentEventId
      ? await prisma.event.findFirst({ where: { id: parentEventId, organizationId: orgId, deletedAt: null }, select: { id: true } })
      : null

    // Ensure unique slug
    let slug = data.slug
    const existingSlug = await prisma.event.findUnique({ where: { slug } })
    if (existingSlug) {
      let counter = 2
      while (await prisma.event.findUnique({ where: { slug: `${slug}-${counter}` } })) {
        counter++
      }
      slug = `${slug}-${counter}`
    }

    // Get org's enterprise for context
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { enterpriseId: true },
    })

    // Publishing straight away: an enterprise that requires approval gets PENDING_APPROVAL
    const outcome = eventStatus === "PUBLISHED" ? await publishOutcome(orgId, session.user.id) : null
    const status = outcome?.status ?? eventStatus

    const event = await prisma.event.create({
      data: {
        ...eventData,
        slug,
        isPaid,
        status,
        parentEventId: parent?.id ?? null,
        settings: mergeEventSettings(null, settings),
        organizationId: orgId,
        enterpriseId: org?.enterpriseId || undefined,
        createdById: session.user.id,
        publishedAt: status === "PUBLISHED" ? new Date() : undefined,
        shortDescription: eventData.shortDescription,
        ticketTypes: ticketTypes.length > 0 ? {
          create: ticketTypes.map((tt, i) => ({
            name: tt.name,
            description: tt.description || null,
            price: tt.price,
            currency: tt.currency || "INR",
            quantity: typeof tt.quantity === "number" ? tt.quantity : null,
            maxPerUser: tt.maxPerUser || 1,
            saleStartDate: tt.saleStartDate instanceof Date ? tt.saleStartDate : null,
            saleEndDate: tt.saleEndDate instanceof Date ? tt.saleEndDate : null,
            isActive: tt.isActive ?? true,
            isHidden: tt.isHidden ?? false,
            sortOrder: i,
          })),
        } : undefined,
        customFormFields: customFormFields.length > 0 ? {
          create: customFormFields.map((f, i) => ({
            label: f.label,
            fieldType: f.fieldType as any,
            placeholder: f.placeholder || null,
            helpText: f.helpText || null,
            isRequired: f.isRequired || false,
            options: f.options || [],
            validation: (f.validation as Prisma.InputJsonValue) || undefined,
            sortOrder: i,
          })),
        } : undefined,
        sessions: sessions.length > 0 ? {
          create: sessions.map((s, i) => ({
            title: s.title,
            description: s.description || null,
            speaker: s.speaker || null,
            speakerBio: s.speakerBio || null,
            speakerAvatar: s.speakerAvatar || null,
            startTime: s.startTime,
            endTime: s.endTime,
            venue: s.venue || null,
            track: s.track || null,
            capacity: typeof s.capacity === "number" ? s.capacity : null,
            sortOrder: i,
          })),
        } : undefined,
        sponsors: sponsors.length > 0 ? {
          create: sponsors.map((sp, i) => ({
            name: sp.name,
            logo: sp.logo || null,
            website: sp.website || null,
            tier: sp.tier,
            sortOrder: i,
          })),
        } : undefined,
        faqs: faqs.length > 0 ? {
          create: faqs.map((f, i) => ({
            question: f.question,
            answer: f.answer,
            sortOrder: i,
          })),
        } : undefined,
      },
      include: {
        ticketTypes: true,
        customFormFields: { orderBy: { sortOrder: "asc" } },
        sessions: { orderBy: { startTime: "asc" } },
        sponsors: { orderBy: { sortOrder: "asc" } },
        faqs: { orderBy: { sortOrder: "asc" } },
      },
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "EVENT",
      entityId: event.id,
      description: `Created event: ${event.title}`,
      ipAddress,
      userAgent,
      organizationId: orgId,
      enterpriseId: org?.enterpriseId || undefined,
    })

    if (status === "PENDING_APPROVAL" && outcome?.enterpriseId) {
      await notifyEventApprovers(outcome.enterpriseId, { id: event.id, title: event.title }, session.user.id)
    }

    return NextResponse.json(
      { success: true, ...(status === "PENDING_APPROVAL" ? { message: PENDING_APPROVAL_MESSAGE } : {}), data: event },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create event error:", error)
    return NextResponse.json({ success: false, message: "Failed to create event" }, { status: 500 })
  }
}

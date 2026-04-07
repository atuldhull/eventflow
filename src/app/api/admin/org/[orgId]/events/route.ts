import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"
import { createFullEventSchema } from "@/lib/validations/event"
import { slugify } from "@/lib/utils"

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

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "10")
  const search = searchParams.get("search") || ""
  const status = searchParams.get("status") || ""
  const category = searchParams.get("category") || ""

  const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null }
  if (search) where.title = { contains: search, mode: "insensitive" }
  if (status) where.status = status
  if (category) where.category = category

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, title: true, slug: true, category: true, status: true, type: true,
        visibility: true, startDate: true, endDate: true, currentRegistrations: true,
        maxCapacity: true, isPaid: true, isFeatured: true, coverImage: true,
      },
    }),
    prisma.event.count({ where: where as any }),
  ])

  return NextResponse.json({
    success: true,
    data: events.map((e) => ({ ...e, startDate: e.startDate.toISOString(), endDate: e.endDate.toISOString() })),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
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
    const body = await request.json()
    const parsed = createFullEventSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const {
      ticketTypes, customFormFields, sessions, sponsors, faqs,
      status: eventStatus, isPaid,
      ...eventData
    } = data

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

    const event = await prisma.event.create({
      data: {
        ...eventData,
        slug,
        isPaid,
        status: eventStatus,
        organizationId: orgId,
        enterpriseId: org?.enterpriseId || undefined,
        createdById: session.user.id,
        publishedAt: eventStatus === "PUBLISHED" ? new Date() : undefined,
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

    return NextResponse.json({ success: true, data: event }, { status: 201 })
  } catch (error) {
    console.error("Create event error:", error)
    return NextResponse.json({ success: false, message: "Failed to create event" }, { status: 500 })
  }
}

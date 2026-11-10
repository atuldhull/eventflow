import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { apiKeyEventWhere, withApiAuth } from "@/lib/api-auth"
import prisma from "@/lib/prisma"
import { checkEventLimit, checkEventLimitForScope } from "@/lib/subscription"
import { z } from "zod/v4"

export const GET = withApiAuth("events:read", async (req, ctx) => {
  const searchParams = req.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
  const status = searchParams.get("status") || ""
  const category = searchParams.get("category") || ""
  const search = searchParams.get("search") || ""
  const sort = searchParams.get("sort") || "created_at"
  const order = searchParams.get("order") || "desc"

  // Only the key's own events (its organization's, or its enterprise's); none for a key
  // linked to neither.
  const where: Record<string, unknown> = { deletedAt: null, AND: [apiKeyEventWhere(ctx)] }
  if (status) where.status = status
  if (category) where.category = category
  if (search) where.title = { contains: search, mode: "insensitive" }

  const sortField = sort === "start_date" ? "startDate" : sort === "title" ? "title" : "createdAt"

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where: where as any,
      orderBy: { [sortField]: order },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, title: true, slug: true, shortDescription: true, status: true, type: true,
        category: true, visibility: true, startDate: true, endDate: true, venue: true, venueCity: true,
        isOnline: true, maxCapacity: true, currentRegistrations: true, isPaid: true, coverImage: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.event.count({ where: where as any }),
  ])

  return NextResponse.json({
    data: events.map((e) => ({ ...e, startDate: e.startDate.toISOString(), endDate: e.endDate.toISOString(), createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString() })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
  })
})

const createEventSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().min(10),
  shortDescription: z.string().max(200).optional(),
  category: z.string().optional(),
  type: z.enum(["SINGLE", "MULTI_DAY", "VIRTUAL", "HYBRID", "RECURRING"]).default("SINGLE"),
  visibility: z.enum(["PUBLIC", "PRIVATE", "INVITE_ONLY", "UNLISTED"]).default("PUBLIC"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  venue: z.string().optional(),
  venueCity: z.string().optional(),
  isOnline: z.boolean().default(false),
  onlinePlatform: z.string().optional(),
  maxCapacity: z.number().int().positive().optional(),
  isPaid: z.boolean().default(false),
})

export const POST = withApiAuth("events:write", async (req, ctx) => {
  // Plan limit, as in the admin create route: events created this month at the plan's level
  // (the enterprise's, for an enterprise organization or an enterprise key). The event
  // belongs to the key's organization (or, for an enterprise key, its enterprise).
  let limit
  if (ctx.organizationId) limit = await checkEventLimit(ctx.organizationId)
  else if (ctx.enterpriseId) limit = await checkEventLimitForScope({ entityType: "enterprise", entityId: ctx.enterpriseId })
  else return NextResponse.json({ error: { code: "forbidden", message: "This API key isn't linked to an organization or enterprise" } }, { status: 403 })
  if (!limit.allowed) {
    return NextResponse.json({ error: { code: "forbidden", message: limit.message, details: { used: limit.used, limit: limit.limit, plan: limit.plan } } }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "bad_request", message: "Validation failed", details: parsed.error.flatten().fieldErrors } }, { status: 400 })
  }

  const slug = parsed.data.title.toLowerCase().replace(/[^\w ]+/g, "").replace(/ +/g, "-") + "-" + Date.now().toString(36)

  const event = await prisma.event.create({
    data: {
      ...parsed.data,
      slug,
      organizationId: ctx.organizationId || undefined,
      enterpriseId: ctx.enterpriseId || undefined,
      createdById: ctx.userId,
      status: "DRAFT",
    },
  })

  return NextResponse.json({ data: { id: event.id, slug: event.slug, status: event.status } }, { status: 201 })
})

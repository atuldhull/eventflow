import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { getClientInfo } from "@/lib/audit"
import { PERMISSIONS, getRolePermissions } from "@/lib/permissions"
import { addParticipantManually, manualRegistrationSchema } from "@/lib/manual-registration"

const REGISTRATION_STATUSES = ["PENDING", "CONFIRMED", "WAITLISTED", "REJECTED", "CANCELLED", "CHECKED_IN", "NO_SHOW"] as const

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
  search: z.string().trim().max(100).catch(""),
  status: z.enum(REGISTRATION_STATUSES).optional().catch(undefined),
  eventId: z.string().trim().min(1).max(64).optional().catch(undefined),
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
  const authResult = await authorize(session.user.id, PERMISSIONS.REGISTRATION_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const { page, limit, search, status, eventId } = listQuerySchema.parse({
    page: sp.get("page") ?? undefined,
    limit: sp.get("limit") ?? undefined,
    search: sp.get("search") ?? undefined,
    status: sp.get("status") || undefined,
    eventId: sp.get("eventId") || undefined,
  })

  // Every query is scoped to this organization's events; an eventId narrows it further
  // (another organization's event id simply matches nothing).
  const scope: Prisma.RegistrationWhereInput = {
    event: { organizationId: orgId, deletedAt: null },
    ...(eventId ? { eventId } : {}),
  }
  const where: Prisma.RegistrationWhereInput = {
    ...scope,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { registrationNumber: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  }

  const [registrations, total, counts] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, registrationNumber: true, status: true, createdAt: true, source: true, eventId: true,
        user: { select: { name: true, email: true } },
        event: { select: { title: true, slug: true } },
        ticketType: { select: { name: true } },
        payment: { select: { amount: true, status: true } },
      },
    }),
    prisma.registration.count({ where }),
    prisma.registration.groupBy({ by: ["status"], where: scope, _count: true }),
  ])

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number>
  const totalAll = counts.reduce((sum, c) => sum + c._count, 0)

  return NextResponse.json({
    success: true,
    data: registrations.map((r) => ({
      id: r.id,
      registrationNumber: r.registrationNumber,
      participantName: r.user.name || "—",
      participantEmail: r.user.email,
      eventId: r.eventId,
      eventTitle: r.event.title,
      status: r.status,
      ticketType: r.ticketType?.name || "General",
      // What the participant pays: the payment's amount (after any discount). Free and
      // complimentary registrations have no payment.
      amount: r.payment ? Number(r.payment.amount) : 0,
      paymentStatus: r.payment?.status ?? null,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    })),
    stats: {
      total: totalAll,
      confirmed: byStatus.CONFIRMED ?? 0,
      pending: byStatus.PENDING ?? 0,
      checkedIn: byStatus.CHECKED_IN ?? 0,
      waitlisted: byStatus.WAITLISTED ?? 0,
      cancelled: (byStatus.CANCELLED ?? 0) + (byStatus.REJECTED ?? 0),
    },
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
  })
}

/**
 * "Add participant": an organizer registers someone by name and email for one of this
 * organization's events. See src/lib/manual-registration.ts for the rules.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.REGISTRATION_ADD_MANUAL, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = manualRegistrationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message || "Validation failed",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 }
    )
  }

  try {
    const canApprove = authResult.role ? getRolePermissions(authResult.role).includes(PERMISSIONS.REGISTRATION_APPROVE) : false
    const result = await addParticipantManually({
      orgId,
      actorId: session.user.id,
      canApprove,
      input: parsed.data,
      client: getClientInfo(request),
    })
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status })
    }
    const message = result.status === "CONFIRMED"
      ? `${parsed.data.name} is registered${result.complimentary ? " with a complimentary ticket" : ""}`
      : result.status === "WAITLISTED"
        ? `The event is full: ${parsed.data.name} is on the waitlist`
        : `${parsed.data.name} is registered and awaiting approval`
    return NextResponse.json(
      {
        success: true,
        message,
        data: {
          registrationId: result.registrationId,
          registrationNumber: result.registrationNumber,
          status: result.status,
          complimentary: result.complimentary,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Add participant error:", error)
    return NextResponse.json({ success: false, message: "Couldn't add the participant. Please try again." }, { status: 500 })
  }
}

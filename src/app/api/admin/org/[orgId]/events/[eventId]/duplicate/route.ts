import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; eventId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, eventId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_CREATE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const source = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      customFormFields: { orderBy: { sortOrder: "asc" } },
      faqs: { orderBy: { sortOrder: "asc" } },
      sponsors: { orderBy: { sortOrder: "asc" } },
    },
  })

  if (!source) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }

  // Generate unique slug
  let slug = `${source.slug}-copy`
  let counter = 1
  while (await prisma.event.findUnique({ where: { slug } })) {
    slug = `${source.slug}-copy-${++counter}`
  }

  // Clone event without dates, registrations, payments
  const { id, createdAt, updatedAt, deletedAt, publishedAt, currentRegistrations, slug: _slug, ...eventData } = source as any

  const duplicate = await prisma.event.create({
    data: {
      ...eventData,
      title: `${source.title} (Copy)`,
      slug,
      status: "DRAFT",
      currentRegistrations: 0,
      publishedAt: null,
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      endDate: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
      registrationStartDate: null,
      registrationEndDate: null,
      createdById: session.user.id,
      ticketTypes: source.ticketTypes.length > 0 ? {
        create: source.ticketTypes.map((tt) => ({
          name: tt.name, description: tt.description, price: tt.price,
          currency: tt.currency, quantity: tt.quantity, maxPerUser: tt.maxPerUser,
          isActive: tt.isActive, isHidden: tt.isHidden, sortOrder: tt.sortOrder,
        })),
      } : undefined,
      customFormFields: source.customFormFields.length > 0 ? {
        create: source.customFormFields.map((f) => ({
          label: f.label, fieldType: f.fieldType, placeholder: f.placeholder,
          helpText: f.helpText, isRequired: f.isRequired, options: f.options as any,
          sortOrder: f.sortOrder,
        })),
      } : undefined,
      faqs: source.faqs.length > 0 ? {
        create: source.faqs.map((f) => ({
          question: f.question, answer: f.answer, sortOrder: f.sortOrder, isPublished: f.isPublished,
        })),
      } : undefined,
      sponsors: source.sponsors.length > 0 ? {
        create: source.sponsors.map((s) => ({
          name: s.name, logo: s.logo, website: s.website, tier: s.tier, sortOrder: s.sortOrder,
        })),
      } : undefined,
    },
  })

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id, action: "CREATE", entityType: "EVENT",
    entityId: duplicate.id, description: `Duplicated event: ${source.title} → ${duplicate.title}`,
    ipAddress, userAgent, organizationId: orgId,
  })

  return NextResponse.json({ success: true, data: { id: duplicate.id, slug: duplicate.slug } }, { status: 201 })
}

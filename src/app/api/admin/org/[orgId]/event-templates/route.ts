import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"

// Event templates stored as draft events with a special flag in settings

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { orgId } = await params

  // Templates are events with settings.isTemplate = true
  const templates = await prisma.event.findMany({
    where: { organizationId: orgId, deletedAt: null, settings: { path: ["isTemplate"], equals: true } },
    select: { id: true, title: true, category: true, type: true, isPaid: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ success: true, data: templates })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  const { orgId } = await params

  const authResult = await authorize(session.user.id, PERMISSIONS.EVENT_CREATE, { organizationId: orgId })
  if (!authResult.authorized) return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })

  const { eventId, templateName } = await request.json()

  const source = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    select: {
      description: true, shortDescription: true, type: true, visibility: true, category: true, tags: true,
      isOnline: true, isPaid: true, approvalRequired: true, waitlistEnabled: true,
      rules: true, termsAndConditions: true, refundPolicy: true, contactEmail: true, contactPhone: true,
      settings: true,
      ticketTypes: { select: { name: true, price: true, currency: true, maxPerUser: true, sortOrder: true } },
      customFormFields: { select: { label: true, fieldType: true, placeholder: true, helpText: true, isRequired: true, options: true, sortOrder: true } },
    },
  })

  if (!source) return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })

  const template = await prisma.event.create({
    data: {
      title: templateName || `Template: ${source.category || "Event"}`,
      slug: `template-${Date.now().toString(36)}`,
      description: source.description,
      shortDescription: source.shortDescription,
      type: source.type,
      visibility: source.visibility,
      category: source.category,
      tags: source.tags,
      isOnline: source.isOnline,
      isPaid: source.isPaid,
      approvalRequired: source.approvalRequired,
      waitlistEnabled: source.waitlistEnabled,
      rules: source.rules,
      termsAndConditions: source.termsAndConditions,
      refundPolicy: source.refundPolicy,
      contactEmail: source.contactEmail,
      contactPhone: source.contactPhone,
      organizationId: orgId,
      createdById: session.user.id,
      status: "DRAFT",
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
      settings: { ...(source.settings as any || {}), isTemplate: true },
      ticketTypes: { create: source.ticketTypes.map(tt => ({ ...tt, price: tt.price })) },
      customFormFields: { create: source.customFormFields.map(f => ({ ...f, options: f.options as any })) },
    },
  })

  return NextResponse.json({ success: true, data: { id: template.id }, message: "Template saved" }, { status: 201 })
}

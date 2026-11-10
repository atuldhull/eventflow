import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { generateBulkCertificates } from "@/lib/certificate"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { getActivePlatformSettings } from "@/lib/platform-settings-store"

const CERT_TYPES = ["PARTICIPATION", "WINNER", "RUNNER_UP", "VOLUNTEER", "SPEAKER", "ORGANIZER"] as const

const generateSchema = z.object({
  eventId: z.string().min(1),
  templateId: z.string().min(1).optional(),
  // Checked-in only unless asked otherwise: a confirmed registrant who never came is a no-show.
  recipientFilter: z.enum(["all_confirmed", "checked_in_only", "custom"]).default("checked_in_only"),
  customRecipientIds: z.array(z.string().min(1)).max(5000).optional(),
  defaultType: z.enum(CERT_TYPES).default("PARTICIPATION"),
  specialAwards: z
    .array(z.object({ userId: z.string().min(1), type: z.enum(CERT_TYPES), customTitle: z.string().trim().max(150).optional() }))
    .max(500)
    .optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.CERTIFICATE_GENERATE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  // Platform settings → Features → Certificate generation
  if (!(await getActivePlatformSettings()).features.certificateGeneration) {
    return NextResponse.json({ success: false, message: "Certificate generation is turned off for the platform" }, { status: 403 })
  }

  const parsed = generateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })
  }
  const body = parsed.data

  // Both the event and the template must belong to the organization the caller was
  // authorized for; ids from another tenant resolve to "not found".
  const event = await prisma.event.findFirst({
    where: { id: body.eventId, organizationId: orgId, deletedAt: null },
    select: { id: true },
  })
  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
  }
  const template = await prisma.certificateTemplate.findFirst({
    where: { organizationId: orgId, ...(body.templateId ? { id: body.templateId } : {}) },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  })
  if (!template) {
    return NextResponse.json(
      { success: false, message: body.templateId ? "Template not found" : "Create a certificate template first" },
      { status: body.templateId ? 404 : 409 }
    )
  }

  try {
    const result = await generateBulkCertificates({
      eventId: event.id,
      templateId: template.id,
      recipientFilter: body.recipientFilter,
      customRecipientIds: body.customRecipientIds,
      defaultType: body.defaultType,
      specialAwards: body.specialAwards,
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "EVENT",
      entityId: event.id,
      description: `Generated ${result.generated} certificates`,
      eventId: event.id,
      ipAddress,
      userAgent,
      organizationId: orgId,
    })

    return NextResponse.json({
      success: true,
      message: `Generated ${result.generated} certificate${result.generated === 1 ? "" : "s"}`,
      data: result,
    })
  } catch (error) {
    console.error("Certificate generation error:", error)
    return NextResponse.json({ success: false, message: "Failed to generate certificates" }, { status: 500 })
  }
}

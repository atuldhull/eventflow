import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { generateBulkCertificates } from "@/lib/certificate"
import { createAuditLog, getClientInfo } from "@/lib/audit"

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

  try {
    const body = await request.json()
    const result = await generateBulkCertificates({
      eventId: body.eventId,
      templateId: body.templateId,
      recipientFilter: body.recipientFilter || "all_confirmed",
      customRecipientIds: body.customRecipientIds,
      defaultType: body.defaultType || "PARTICIPATION",
      specialAwards: body.specialAwards,
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "EVENT",
      entityId: body.eventId,
      description: `Generated ${result.generated} certificates`,
      ipAddress,
      userAgent,
      organizationId: orgId,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Certificate generation error:", error)
    return NextResponse.json({ success: false, message: "Failed to generate certificates" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { isCertificateRevoked, restoredCertificateData, revokedCertificateMetadata } from "@/lib/certificate-verification"
import { notify, notifySafely } from "@/lib/notifications"

const actionSchema = z.object({
  action: z.enum(["revoke", "restore"]),
  reason: z.string().trim().max(500).optional(),
})

/**
 * Revokes or restores one of this organization's certificates. A revocation is recorded in
 * the certificate's metadata (revokedAt, revokedBy, revokedReason) and the issued status is
 * kept; restoring removes it. See src/lib/certificate-verification.ts, which every reader
 * (verification page and API, download, lists) uses.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; certificateId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId, certificateId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.CERTIFICATE_MANAGE, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Validation failed" }, { status: 400 })
  }
  const { action, reason } = parsed.data

  // scoped to this organization: another tenant's certificate id is "not found"
  const certificate = await prisma.certificate.findFirst({
    where: { id: certificateId, event: { organizationId: orgId } },
    select: { id: true, status: true, downloadedAt: true, metadata: true, certificateNumber: true, eventId: true, userId: true, event: { select: { title: true } } },
  })
  if (!certificate) {
    return NextResponse.json({ success: false, message: "Certificate not found" }, { status: 404 })
  }

  const isRevoked = isCertificateRevoked(certificate.metadata)
  if (action === "revoke" && isRevoked) {
    return NextResponse.json({ success: false, message: "This certificate is already revoked" }, { status: 409 })
  }
  if (action === "restore" && !isRevoked) {
    return NextResponse.json({ success: false, message: "This certificate isn't revoked" }, { status: 409 })
  }

  const updated = await prisma.certificate.update({
    where: { id: certificate.id },
    data:
      action === "revoke"
        ? { metadata: revokedCertificateMetadata(certificate.metadata, { revokedBy: session.user.id, reason }) }
        : restoredCertificateData(certificate),
    select: { status: true, metadata: true },
  })

  // the recipient is told once: the already-revoked case was turned away above
  if (action === "revoke") {
    await notifySafely(() => notify.certificateRevoked(certificate.userId, certificate.eventId, certificate.event?.title ?? "your event"))
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: action === "revoke" ? "CANCEL" : "UPDATE",
    entityType: "CERTIFICATE",
    entityId: certificate.id,
    description: `${action === "revoke" ? "Revoked" : "Restored"} certificate ${certificate.certificateNumber}${action === "revoke" && reason ? `: ${reason}` : ""}`,
    eventId: certificate.eventId,
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  return NextResponse.json({
    success: true,
    message: action === "revoke" ? "Certificate revoked" : "Certificate restored",
    data: { status: isCertificateRevoked(updated.metadata) ? "REVOKED" : updated.status },
  })
}

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { createNotification } from "@/lib/notifications"
import { escapeHtml } from "@/lib/escape-html"
import { certificateVerificationState } from "@/lib/certificate-verification"

/** Emails a participant their certificate again (with an in-app notice), and marks it sent. */
export async function POST(
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

  const certificate = await prisma.certificate.findFirst({
    where: { id: certificateId, event: { organizationId: orgId } },
    select: {
      id: true, status: true, metadata: true, title: true, recipientName: true, certificateNumber: true,
      verificationCode: true, userId: true, eventId: true,
      user: { select: { email: true } },
      event: { select: { title: true, organization: { select: { name: true } } } },
    },
  })
  if (!certificate) {
    return NextResponse.json({ success: false, message: "Certificate not found" }, { status: 404 })
  }
  const state = certificateVerificationState(certificate.status, certificate.metadata)
  if (state !== "valid") {
    return NextResponse.json(
      { success: false, message: state === "revoked" ? "A revoked certificate can't be sent" : "This certificate hasn't been issued yet" },
      { status: 409 }
    )
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")
  const verifyUrl = `${appUrl}/verify/${encodeURIComponent(certificate.verificationCode)}`
  const dashboardUrl = `${appUrl}/dashboard/certificates`
  const orgName = certificate.event.organization?.name || "The organizer"

  const result = await sendEmail({
    to: certificate.user.email,
    subject: `Your certificate for ${certificate.event.title}`,
    html: `
      <h2>${escapeHtml(certificate.title)}</h2>
      <p>Hi ${escapeHtml(certificate.recipientName)},</p>
      <p>${escapeHtml(orgName)} has issued you a certificate for <strong>${escapeHtml(certificate.event.title)}</strong>.</p>
      <p><a href="${escapeHtml(dashboardUrl)}">Download it from your dashboard</a></p>
      <p>Anyone can check it is genuine at <a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a>
      (certificate ${escapeHtml(certificate.certificateNumber)}).</p>
    `,
  })
  if (!result.success) {
    return NextResponse.json({ success: false, message: "The email couldn't be sent. Try again later." }, { status: 502 })
  }

  await createNotification({
    userId: certificate.userId,
    type: "IN_APP",
    category: "CERTIFICATE",
    title: "Your certificate is ready",
    message: `${certificate.title} for ${certificate.event.title}`,
    eventId: certificate.eventId,
    senderId: session.user.id,
  })

  if (certificate.status === "GENERATED") {
    await prisma.certificate.update({ where: { id: certificate.id }, data: { status: "SENT" } })
  }

  const { ipAddress, userAgent } = getClientInfo(request)
  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "CERTIFICATE",
    entityId: certificate.id,
    description: `Emailed certificate ${certificate.certificateNumber} to the recipient`,
    eventId: certificate.eventId,
    ipAddress,
    userAgent,
    organizationId: orgId,
  })

  return NextResponse.json({ success: true, message: `Sent to ${certificate.user.email}` })
}

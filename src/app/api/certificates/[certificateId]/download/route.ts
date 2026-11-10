import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { certificateDesignFromTemplate, fillCertificateTags, fillCertificateTagsText, generateCertificateHTML } from "@/lib/certificate-pdf"
import { renderCertificatePdf } from "@/lib/certificate-pdf-file"
import { defaultCertificateTitle } from "@/lib/certificate"
import { escapeHtml } from "@/lib/escape-html"
import { certificateVerificationState } from "@/lib/certificate-verification"

/**
 * The certificate as a PDF file (A4, in the design of its template), or with ?format=html
 * as the printable HTML page it used to be. The recipient can open their own (unless it was
 * revoked); the issuing organization's staff with certificate access can open any of its
 * certificates, e.g. from the organizer's certificates list, without it counting as the
 * recipient's download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { certificateId } = await params

  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      event: { select: { title: true, startDate: true, organizationId: true, organization: { select: { name: true } } } },
      user: { select: { id: true, name: true } },
      template: { select: { templateHtml: true } },
    },
  })

  if (!certificate) {
    return NextResponse.json({ success: false, message: "Certificate not found" }, { status: 404 })
  }

  const isRecipient = certificate.userId === session.user.id
  let isOrgStaff = false
  if (!isRecipient && certificate.event.organizationId) {
    const access = await authorize(session.user.id, PERMISSIONS.CERTIFICATE_VIEW, {
      organizationId: certificate.event.organizationId,
    })
    isOrgStaff = access.authorized
  }
  if (!isRecipient && !isOrgStaff) {
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 })
  }

  // A revoked (or not yet issued) certificate is not handed to its recipient; staff can
  // still open it to check what was issued.
  const state = certificateVerificationState(certificate.status, certificate.metadata)
  if (state !== "valid" && !isOrgStaff) {
    return NextResponse.json(
      { success: false, message: state === "revoked" ? "This certificate has been revoked" : "This certificate hasn't been issued yet" },
      { status: 410 }
    )
  }

  // The design the certificate was issued with; when its template is gone (or none was set),
  // the organization's default template; the built-in layout only when neither exists.
  let templateHtml = certificate.template?.templateHtml ?? null
  if (!templateHtml && certificate.event.organizationId) {
    const orgDefault = await prisma.certificateTemplate.findFirst({
      where: { organizationId: certificate.event.organizationId, isDefault: true },
      orderBy: { createdAt: "desc" },
      select: { templateHtml: true },
    })
    templateHtml = orgDefault?.templateHtml ?? null
  }
  const design = certificateDesignFromTemplate(templateHtml)

  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })
  const asHtml = request.nextUrl.searchParams.get("format") === "html"
  // One template is applied to a whole event, special awards included. Its layout (paper,
  // colours, font) always applies; its title and text replace the generic participation
  // wording only. An award ("Winner Certificate") or a custom title given when issuing keeps
  // its own title and type-specific text.
  const usesTemplateWording =
    certificate.type === "PARTICIPATION" && certificate.title === defaultCertificateTitle("PARTICIPATION")
  const renderDesign = design && !usesTemplateWording ? { ...design, bodyText: null } : design

  // Only the recipient's own download is tracked; it changes the status only, so a
  // revocation (metadata.revokedAt) is never undone by it.
  // Recorded once the file is built, just before it is sent.
  const trackDownload = async () => {
    if (isRecipient && state === "valid") {
      await prisma.certificate.update({
        where: { id: certificateId },
        data: { downloadedAt: certificate.downloadedAt || new Date(), status: "DOWNLOADED" },
      })
    }
  }

  if (asHtml) {
    // Every value is escaped before it goes into the page: names and titles are typed by
    // participants and organizers, and this HTML is served from the app's own origin.
    const safe = {
      recipientName: escapeHtml(certificate.recipientName),
      eventTitle: escapeHtml(certificate.event.title),
      eventDate: escapeHtml(fmt(certificate.event.startDate)),
      organizerName: escapeHtml(certificate.event.organization?.name || "EventFlow"),
      certificateNumber: escapeHtml(certificate.certificateNumber),
    }
    const tags = {
      name: safe.recipientName, event_title: safe.eventTitle, event_date: safe.eventDate,
      organizer_name: safe.organizerName, certificate_id: safe.certificateNumber,
    }
    const title =
      usesTemplateWording && design?.titleText ? fillCertificateTags(design.titleText, tags) : escapeHtml(certificate.title)
    const html = await generateCertificateHTML({
      ...safe,
      verificationCode: encodeURIComponent(certificate.verificationCode),
      type: escapeHtml(certificate.type),
      title,
      issuedDate: escapeHtml(fmt(certificate.issuedDate)),
    }, renderDesign)

    await trackDownload()
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="certificate-${certificate.certificateNumber.replace(/[^\w-]/g, "")}.html"`,
        // the page needs only its inline styles and the inline QR image; no scripts at all
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    })
  }

  // The PDF takes the values as plain text.
  const plain = {
    recipientName: certificate.recipientName,
    eventTitle: certificate.event.title,
    eventDate: fmt(certificate.event.startDate),
    organizerName: certificate.event.organization?.name || "EventFlow",
    certificateNumber: certificate.certificateNumber,
  }
  const plainTags = {
    name: plain.recipientName, event_title: plain.eventTitle, event_date: plain.eventDate,
    organizer_name: plain.organizerName, certificate_id: plain.certificateNumber,
  }
  const pdf = renderCertificatePdf({
    ...plain,
    verificationCode: certificate.verificationCode,
    type: certificate.type,
    title: usesTemplateWording && design?.titleText ? fillCertificateTagsText(design.titleText, plainTags) : certificate.title,
    issuedDate: fmt(certificate.issuedDate),
    bodyText: renderDesign?.bodyText ? fillCertificateTagsText(renderDesign.bodyText, plainTags) : null,
  }, renderDesign)

  await trackDownload()
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${certificate.certificateNumber.replace(/[^\w-]/g, "")}.pdf"`,
      "Content-Length": String(pdf.length),
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  })
}

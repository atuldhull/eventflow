import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { generateCertificateHTML } from "@/lib/certificate-pdf"

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
      event: { select: { title: true, startDate: true, organization: { select: { name: true } } } },
      user: { select: { id: true, name: true } },
    },
  })

  if (!certificate) {
    return NextResponse.json({ success: false, message: "Certificate not found" }, { status: 404 })
  }

  if (certificate.userId !== session.user.id) {
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 })
  }

  const html = await generateCertificateHTML({
    recipientName: certificate.recipientName,
    eventTitle: certificate.event.title,
    eventDate: certificate.event.startDate.toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" }),
    organizerName: certificate.event.organization?.name || "EventFlow",
    certificateNumber: certificate.certificateNumber,
    verificationCode: certificate.verificationCode,
    type: certificate.type,
    title: certificate.title,
    issuedDate: certificate.issuedDate.toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" }),
  })

  // Update download tracking
  await prisma.certificate.update({
    where: { id: certificateId },
    data: { downloadedAt: certificate.downloadedAt || new Date(), status: "DOWNLOADED" },
  })

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="certificate-${certificate.certificateNumber}.html"`,
    },
  })
}

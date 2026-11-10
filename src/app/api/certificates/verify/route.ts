import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod/v4"
import prisma from "@/lib/prisma"
import { VERIFICATION_CODE_PATTERN, certificateVerificationState, revokedAt } from "@/lib/certificate-verification"

const querySchema = z.object({
  code: z.string().trim().regex(VERIFICATION_CODE_PATTERN, "Invalid verification code"),
})

/**
 * Public certificate check. Returns what the certificate itself shows (number, recipient,
 * event, type, issue date) and its state: valid, not issued yet, or revoked. Nothing else
 * about the recipient (no email, no account id).
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ code: request.nextUrl.searchParams.get("code") ?? "" })
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "A valid verification code is required" }, { status: 400 })
  }

  const certificate = await prisma.certificate.findUnique({
    where: { verificationCode: parsed.data.code },
    select: {
      certificateNumber: true,
      recipientName: true,
      type: true,
      title: true,
      issuedDate: true,
      status: true,
      metadata: true,
      event: { select: { title: true, startDate: true } },
    },
  })

  if (!certificate) {
    return NextResponse.json({ success: true, message: "Certificate not found", data: { valid: false, reason: "not_found" } })
  }

  const state = certificateVerificationState(certificate.status, certificate.metadata)
  if (state === "not_issued") {
    return NextResponse.json({
      success: true,
      message: "This certificate hasn't been issued yet",
      data: { valid: false, reason: "not_issued", certificateNumber: certificate.certificateNumber },
    })
  }
  if (state === "revoked") {
    return NextResponse.json({
      success: true,
      message: "This certificate has been revoked",
      data: {
        valid: false,
        reason: "revoked",
        certificateNumber: certificate.certificateNumber,
        revokedAt: revokedAt(certificate.metadata)?.toISOString() ?? null,
      },
    })
  }

  return NextResponse.json({
    success: true,
    message: "Certificate verified",
    data: {
      valid: true,
      certificate: {
        number: certificate.certificateNumber,
        recipientName: certificate.recipientName,
        eventTitle: certificate.event.title,
        eventDate: certificate.event.startDate.toISOString(),
        type: certificate.type,
        title: certificate.title,
        issuedDate: certificate.issuedDate.toISOString(),
      },
    },
  })
}

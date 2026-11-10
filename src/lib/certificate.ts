import crypto from "crypto"
import prisma from "@/lib/prisma"
import { certificateVerificationState, restoredCertificateData, revokedCertificateMetadata } from "@/lib/certificate-verification"
import { notify, notifySafely } from "@/lib/notifications"

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function generateCode(prefix: string, length: number): string {
  let code = prefix
  for (let i = 0; i < length; i++) {
    code += CHARSET[crypto.randomInt(CHARSET.length)]
  }
  return code
}

/** The title a certificate of this type gets when no custom title is given. */
export function defaultCertificateTitle(type: string): string {
  return type === "PARTICIPATION" ? "Certificate of Participation" :
    type === "WINNER" ? "Winner Certificate" :
    type === "RUNNER_UP" ? "Runner-Up Certificate" :
    type === "VOLUNTEER" ? "Certificate of Appreciation" :
    type === "SPEAKER" ? "Speaker Certificate" :
    type === "ORGANIZER" ? "Organizer Certificate" : "Certificate"
}

export async function generateCertificate(params: {
  registrationId: string
  templateId: string
  type: string
  customTitle?: string
  recipientName?: string
}) {
  const registration = await prisma.registration.findUnique({
    where: { id: params.registrationId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      event: { select: { id: true, title: true, startDate: true, organization: { select: { name: true } } } },
    },
  })

  if (!registration) throw new Error("Registration not found")

  // Check for existing certificate
  const existing = await prisma.certificate.findFirst({
    where: { eventId: registration.event.id, userId: registration.user.id, type: params.type },
  })
  if (existing) return { certificate: existing, skipped: true }

  const certificateNumber = generateCode("CERT-", 6)
  const verificationCode = generateCode("VER-", 8)

  const recipientName = params.recipientName || registration.user.name
  const title = params.customTitle || defaultCertificateTitle(params.type)

  const certificate = await prisma.certificate.create({
    data: {
      certificateNumber,
      eventId: registration.event.id,
      userId: registration.user.id,
      templateId: params.templateId,
      type: params.type,
      title,
      recipientName,
      issuedDate: new Date(),
      verificationCode,
      status: "GENERATED",
    },
  })
  // a new certificate only (an existing one returned above was announced when issued)
  await notifySafely(() => notify.certificateReady(certificate.userId, certificate.eventId, registration.event.title))

  return { certificate, skipped: false }
}

export async function generateBulkCertificates(params: {
  eventId: string
  templateId: string
  recipientFilter: "all_confirmed" | "checked_in_only" | "custom"
  customRecipientIds?: string[]
  defaultType?: string
  specialAwards?: { userId: string; type: string; customTitle?: string }[]
}) {
  const { eventId, templateId, recipientFilter, customRecipientIds, specialAwards } = params
  const defaultType = params.defaultType || "PARTICIPATION"

  let registrations: { id: string; userId: string }[]

  if (recipientFilter === "custom" && customRecipientIds) {
    registrations = await prisma.registration.findMany({
      where: { eventId, userId: { in: customRecipientIds } },
      select: { id: true, userId: true },
    })
  } else if (recipientFilter === "checked_in_only") {
    registrations = await prisma.registration.findMany({
      where: { eventId, status: "CHECKED_IN" },
      select: { id: true, userId: true },
    })
  } else {
    registrations = await prisma.registration.findMany({
      where: { eventId, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      select: { id: true, userId: true },
    })
  }

  const specialAwardMap = new Map(
    (specialAwards || []).map((a) => [a.userId, { type: a.type, customTitle: a.customTitle }])
  )

  let generated = 0
  let skipped = 0
  let failed = 0

  for (const reg of registrations) {
    try {
      const award = specialAwardMap.get(reg.userId)
      const result = await generateCertificate({
        registrationId: reg.id,
        templateId,
        type: award?.type || defaultType,
        customTitle: award?.customTitle,
      })
      if (result.skipped) skipped++
      else generated++
    } catch (error) {
      console.error(`Certificate generation failed for registration ${reg.id}:`, error)
      failed++
    }
  }

  return { total: registrations.length, generated, skipped, failed }
}

export async function verifyCertificate(verificationCode: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { verificationCode },
    select: {
      certificateNumber: true,
      recipientName: true,
      type: true,
      title: true,
      issuedDate: true,
      status: true,
      metadata: true,
      event: { select: { title: true, startDate: true } },
      user: { select: { name: true } },
    },
  })

  if (!certificate) {
    return { valid: false, reason: "not_found" as const }
  }

  // one rule for every reader: revoked = metadata.revokedAt; PENDING = not issued yet
  const state = certificateVerificationState(certificate.status, certificate.metadata)
  if (state !== "valid") {
    return { valid: false, reason: state, certificateNumber: certificate.certificateNumber }
  }

  return {
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
  }
}

/** Records a revocation in metadata (the issued status is kept). Callers scope the id first. */
export async function revokeCertificate(certificateId: string, revocation: { revokedBy: string; reason?: string | null }) {
  const certificate = await prisma.certificate.findUniqueOrThrow({
    where: { id: certificateId },
    select: { metadata: true, status: true, userId: true, eventId: true, event: { select: { title: true } } },
  })
  const wasValid = certificateVerificationState(certificate.status, certificate.metadata) === "valid"
  const updated = await prisma.certificate.update({
    where: { id: certificateId },
    data: { metadata: revokedCertificateMetadata(certificate.metadata, revocation) },
  })
  // the recipient is told once, when a certificate they could use is withdrawn
  if (wasValid) await notifySafely(() => notify.certificateRevoked(certificate.userId, certificate.eventId, certificate.event.title))
  return updated
}

/** Undoes revokeCertificate. Callers scope the id first. */
export async function restoreCertificate(certificateId: string) {
  const certificate = await prisma.certificate.findUniqueOrThrow({
    where: { id: certificateId },
    select: { status: true, metadata: true, downloadedAt: true },
  })
  return prisma.certificate.update({ where: { id: certificateId }, data: restoredCertificateData(certificate) })
}

export async function getUserCertificates(userId: string) {
  return prisma.certificate.findMany({
    where: { userId },
    include: {
      event: { select: { title: true, slug: true, startDate: true, organization: { select: { name: true } } } },
    },
    orderBy: { issuedDate: "desc" },
  })
}

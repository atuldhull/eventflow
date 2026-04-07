import crypto from "crypto"
import prisma from "@/lib/prisma"

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function generateCode(prefix: string, length: number): string {
  let code = prefix
  for (let i = 0; i < length; i++) {
    code += CHARSET[crypto.randomInt(CHARSET.length)]
  }
  return code
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
  const title = params.customTitle ||
    (params.type === "PARTICIPATION" ? "Certificate of Participation" :
     params.type === "WINNER" ? "Winner Certificate" :
     params.type === "RUNNER_UP" ? "Runner-Up Certificate" :
     params.type === "VOLUNTEER" ? "Certificate of Appreciation" :
     params.type === "SPEAKER" ? "Speaker Certificate" :
     params.type === "ORGANIZER" ? "Organizer Certificate" : "Certificate")

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
      event: { select: { title: true, startDate: true } },
      user: { select: { name: true } },
    },
  })

  if (!certificate) {
    return { valid: false, reason: "not_found" as const }
  }

  if (certificate.status === "PENDING") {
    return { valid: false, reason: "revoked" as const, certificateNumber: certificate.certificateNumber }
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

export async function revokeCertificate(certificateId: string) {
  return prisma.certificate.update({
    where: { id: certificateId },
    data: { status: "PENDING" }, // Using PENDING as revoked status since no REVOKED in enum
  })
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

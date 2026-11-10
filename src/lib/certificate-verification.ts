import { Prisma } from "@prisma/client"
import type { CertificateStatus } from "@prisma/client"

/**
 * What a certificate's verification page should say.
 *
 * - valid: issued (GENERATED, SENT or DOWNLOADED) and not revoked
 * - not_issued: the record exists but the certificate hasn't been issued yet (PENDING)
 * - revoked: the organizer withdrew it
 *
 * The CertificateStatus enum has no REVOKED value, so a revocation lives in the
 * certificate's metadata, and `metadata.revokedAt` is the single source of truth: revoking
 * sets it (with `revokedBy` and an optional `revokedReason`) and leaves the issued status
 * alone; restoring removes those keys. PENDING only ever means "not issued yet".
 * Every reader (verification page and API, download, organizer list, resend, the user's
 * own list, src/lib/certificate.ts) goes through these helpers.
 */
export type CertificateVerificationState = "valid" | "not_issued" | "revoked"

export const ISSUED_CERTIFICATE_STATUSES = ["GENERATED", "SENT", "DOWNLOADED"] as const
type IssuedStatus = (typeof ISSUED_CERTIFICATE_STATUSES)[number]

/** Metadata keys a revocation writes (statusBeforeRevoke is from older revocations). */
const REVOCATION_KEYS = ["revokedAt", "revokedBy", "revokedReason", "statusBeforeRevoke"]

/** Prisma filters matching the same rule as isCertificateRevoked (a JSON path that's present and not null). */
export const REVOKED_CERTIFICATE_WHERE = {
  metadata: { path: ["revokedAt"], not: Prisma.AnyNull },
} satisfies Prisma.CertificateWhereInput
export const NOT_REVOKED_CERTIFICATE_WHERE = {
  metadata: { path: ["revokedAt"], equals: Prisma.AnyNull },
} satisfies Prisma.CertificateWhereInput

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function isCertificateRevoked(metadata: unknown): boolean {
  const value = asRecord(metadata).revokedAt
  return value !== undefined && value !== null
}

export function certificateVerificationState(status: CertificateStatus | string, metadata?: unknown): CertificateVerificationState {
  if (isCertificateRevoked(metadata)) return "revoked"
  if ((ISSUED_CERTIFICATE_STATUSES as readonly string[]).includes(status)) return "valid"
  return "not_issued"
}

export function revokedAt(metadata: unknown): Date | null {
  const value = asRecord(metadata).revokedAt
  if (typeof value !== "string" && !(value instanceof Date)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** The metadata a revocation stores. The certificate's status is left as it is. */
export function revokedCertificateMetadata(
  metadata: unknown,
  revocation: { revokedBy: string; reason?: string | null; at?: Date }
): Prisma.InputJsonObject {
  const reason = revocation.reason?.trim()
  return {
    ...withoutRevocation(metadata),
    revokedAt: (revocation.at ?? new Date()).toISOString(),
    revokedBy: revocation.revokedBy,
    ...(reason ? { revokedReason: reason } : {}),
  } as Prisma.InputJsonObject
}

/**
 * What restoring a revoked certificate writes: the revocation keys removed and, for a
 * certificate revoked the older way (status set to PENDING), the issued status put back.
 */
export function restoredCertificateData(certificate: {
  status: CertificateStatus | string
  metadata: unknown
  downloadedAt?: Date | null
}): { status: IssuedStatus | CertificateStatus; metadata: Prisma.InputJsonObject } {
  const meta = asRecord(certificate.metadata)
  let status = certificate.status as CertificateStatus
  if (status === "PENDING") {
    const before = meta.statusBeforeRevoke
    status = (ISSUED_CERTIFICATE_STATUSES as readonly unknown[]).includes(before)
      ? (before as IssuedStatus)
      : certificate.downloadedAt ? "DOWNLOADED" : "GENERATED"
  }
  return { status, metadata: withoutRevocation(meta) }
}

function withoutRevocation(metadata: unknown): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(asRecord(metadata)).filter(([key]) => !REVOCATION_KEYS.includes(key))
  ) as Prisma.InputJsonObject
}

/** Verification codes are short uppercase tokens (VER-XXXXXXXX); bound what we look up. */
export const VERIFICATION_CODE_PATTERN = /^[A-Za-z0-9_-]{4,64}$/

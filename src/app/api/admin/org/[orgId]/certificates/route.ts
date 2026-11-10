import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { paginationMeta, parseEnumParam, parseListParams } from "@/lib/list-params"
import {
  NOT_REVOKED_CERTIFICATE_WHERE,
  REVOKED_CERTIFICATE_WHERE,
  isCertificateRevoked,
} from "@/lib/certificate-verification"

// REVOKED is derived from metadata.revokedAt (see src/lib/certificate-verification.ts);
// the other filters are issued statuses of certificates that aren't revoked.
const STATUS_FILTERS = ["GENERATED", "SENT", "DOWNLOADED", "REVOKED"] as const

/** Certificates issued for this organization's events, with search and a status filter. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const authResult = await authorize(session.user.id, PERMISSIONS.CERTIFICATE_VIEW, { organizationId: orgId })
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: authResult.message }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const { page, limit, skip, search } = parseListParams(searchParams, { defaultLimit: 10 })
  const status = parseEnumParam(searchParams, "status", STATUS_FILTERS)

  const orgScope: Prisma.CertificateWhereInput = { event: { organizationId: orgId, deletedAt: null } }
  const where: Prisma.CertificateWhereInput = {
    ...orgScope,
    ...(status === "REVOKED" ? REVOKED_CERTIFICATE_WHERE : status ? { status, ...NOT_REVOKED_CERTIFICATE_WHERE } : {}),
    ...(search
      ? {
          OR: [
            { recipientName: { contains: search, mode: "insensitive" } },
            { certificateNumber: { contains: search, mode: "insensitive" } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { event: { title: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  }

  const [certificates, total, byStatus, revokedCount] = await Promise.all([
    prisma.certificate.findMany({
      where,
      orderBy: { issuedDate: "desc" },
      skip,
      take: limit,
      select: {
        id: true, certificateNumber: true, recipientName: true, type: true, title: true, status: true,
        issuedDate: true, downloadedAt: true, verificationCode: true, metadata: true,
        user: { select: { email: true } },
        event: { select: { id: true, title: true } },
      },
    }),
    prisma.certificate.count({ where }),
    prisma.certificate.groupBy({ by: ["status"], where: { ...orgScope, ...NOT_REVOKED_CERTIFICATE_WHERE }, _count: { _all: true } }),
    prisma.certificate.count({ where: { ...orgScope, ...REVOKED_CERTIFICATE_WHERE } }),
  ])

  // PENDING (not issued yet) certificates count towards the total only
  const counts = { total: revokedCount, GENERATED: 0, SENT: 0, DOWNLOADED: 0, REVOKED: revokedCount }
  for (const s of byStatus) {
    if (s.status !== "PENDING") counts[s.status] += s._count._all
    counts.total += s._count._all
  }

  return NextResponse.json({
    success: true,
    data: certificates.map((c) => ({
      id: c.id,
      certificateNumber: c.certificateNumber,
      recipientName: c.recipientName,
      recipientEmail: c.user.email,
      eventId: c.event.id,
      eventTitle: c.event.title,
      type: c.type,
      title: c.title,
      status: isCertificateRevoked(c.metadata) ? "REVOKED" : c.status,
      issuedDate: c.issuedDate.toISOString(),
      downloadedAt: c.downloadedAt?.toISOString() ?? null,
      verificationCode: c.verificationCode,
    })),
    counts,
    pagination: paginationMeta(page, limit, total),
  })
}

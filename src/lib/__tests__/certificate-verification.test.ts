import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  certificateVerificationState,
  isCertificateRevoked,
  restoredCertificateData,
  revokedAt,
  revokedCertificateMetadata,
} from "@/lib/certificate-verification"

// /verify/[code] and GET /api/certificates/verify: PENDING means "not issued yet", never
// "revoked"; a revocation is recorded in metadata.
const mocks = vi.hoisted(() => ({ prisma: { certificate: { findUnique: vi.fn() } } }))
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }))

import { GET } from "@/app/api/certificates/verify/route"

const verify = (code: string) => GET(new NextRequest(`http://localhost/api/certificates/verify?code=${encodeURIComponent(code)}`))

const CERT = {
  certificateNumber: "CERT-2026-0001", recipientName: "Carol", type: "PARTICIPATION", title: "Certificate of Participation",
  issuedDate: new Date("2026-10-20T00:00:00Z"), status: "GENERATED", metadata: null,
  event: { title: "Hack the Monsoon", startDate: new Date("2026-10-17T00:00:00Z") },
}

beforeEach(() => vi.clearAllMocks())

describe("certificateVerificationState", () => {
  it("maps every status", () => {
    expect(certificateVerificationState("GENERATED")).toBe("valid")
    expect(certificateVerificationState("SENT")).toBe("valid")
    expect(certificateVerificationState("DOWNLOADED")).toBe("valid")
    expect(certificateVerificationState("PENDING")).toBe("not_issued")
    expect(certificateVerificationState("SOMETHING_NEW")).toBe("not_issued")
  })

  it("treats metadata.revokedAt (and only that) as revoked, whatever the status", () => {
    expect(certificateVerificationState("GENERATED", { revokedAt: "2026-11-01T00:00:00Z" })).toBe("revoked")
    expect(certificateVerificationState("PENDING", { revokedAt: "2026-11-01T00:00:00Z" })).toBe("revoked")
    // the same rule as the database filter: present and not null
    expect(certificateVerificationState("GENERATED", { revokedAt: null })).toBe("valid")
    expect(certificateVerificationState("GENERATED", { revoked: true })).toBe("valid")
    expect(certificateVerificationState("GENERATED", [])).toBe("valid")
    expect(revokedAt({ revokedAt: "2026-11-01T00:00:00Z" })?.toISOString()).toBe("2026-11-01T00:00:00.000Z")
    expect(revokedAt({ revokedAt: "garbage" })).toBeNull()
  })
})

describe("revoke and restore", () => {
  const at = new Date("2026-11-09T10:00:00Z")
  it("revoking records who, when and why in metadata and keeps the other keys", () => {
    const meta = revokedCertificateMetadata({ note: "kept" }, { revokedBy: "u1", reason: "  issued by mistake ", at })
    expect(meta).toEqual({ note: "kept", revokedAt: at.toISOString(), revokedBy: "u1", revokedReason: "issued by mistake" })
    expect(isCertificateRevoked(meta)).toBe(true)
    expect(revokedCertificateMetadata(null, { revokedBy: "u1", reason: " ", at })).not.toHaveProperty("revokedReason")
  })
  it("restoring removes the revocation and keeps an issued status", () => {
    const meta = revokedCertificateMetadata({ note: "kept" }, { revokedBy: "u1", at })
    const restored = restoredCertificateData({ status: "SENT", metadata: meta })
    expect(restored).toEqual({ status: "SENT", metadata: { note: "kept" } })
    expect(certificateVerificationState(restored.status, restored.metadata)).toBe("valid")
  })
  it("restoring a certificate revoked the older way (status PENDING) puts the issued status back", () => {
    const old = { revokedAt: at.toISOString(), revokedBy: "u1", statusBeforeRevoke: "DOWNLOADED" }
    expect(restoredCertificateData({ status: "PENDING", metadata: old })).toEqual({ status: "DOWNLOADED", metadata: {} })
    const noBefore = { revokedAt: at.toISOString() }
    expect(restoredCertificateData({ status: "PENDING", metadata: noBefore, downloadedAt: null }).status).toBe("GENERATED")
    expect(restoredCertificateData({ status: "PENDING", metadata: noBefore, downloadedAt: at }).status).toBe("DOWNLOADED")
  })
})

describe("GET /api/certificates/verify", () => {
  it("400s without a well-formed code", async () => {
    expect((await verify("")).status).toBe(400)
    expect((await verify("a b<script>")).status).toBe(400)
    expect(mocks.prisma.certificate.findUnique).not.toHaveBeenCalled()
  })

  it("reports not found", async () => {
    mocks.prisma.certificate.findUnique.mockResolvedValue(null)
    expect((await (await verify("VER-NOPE1234")).json()).data).toEqual({ valid: false, reason: "not_found" })
  })

  it("reports a PENDING certificate as not issued, not revoked", async () => {
    mocks.prisma.certificate.findUnique.mockResolvedValue({ ...CERT, status: "PENDING" })
    const json = await (await verify("VER-PENDING1")).json()
    expect(json.data).toEqual({ valid: false, reason: "not_issued", certificateNumber: "CERT-2026-0001" })
  })

  it("reports a revoked certificate", async () => {
    mocks.prisma.certificate.findUnique.mockResolvedValue({ ...CERT, metadata: { revokedAt: "2026-11-01T00:00:00.000Z" } })
    const json = await (await verify("VER-REVOKED1")).json()
    expect(json.data).toMatchObject({ valid: false, reason: "revoked", revokedAt: "2026-11-01T00:00:00.000Z" })
  })

  it("returns the certificate's own details when valid, nothing about the account", async () => {
    mocks.prisma.certificate.findUnique.mockResolvedValue(CERT)
    const json = await (await verify("VER-GOOD1234")).json()
    expect(json).toMatchObject({ success: true, data: { valid: true, certificate: { number: "CERT-2026-0001", recipientName: "Carol", eventTitle: "Hack the Monsoon" } } })
    const { select } = mocks.prisma.certificate.findUnique.mock.calls[0][0]
    expect(select.user).toBeUndefined()
    expect(select.userId).toBeUndefined()
  })
})

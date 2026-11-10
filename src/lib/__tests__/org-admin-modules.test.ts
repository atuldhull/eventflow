import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Organizer admin modules (members, payments, certificates, communications, settings):
// the pure helpers, and route-level tenant scoping with an in-memory Prisma whose finders
// honour the `where` they get, so an unscoped lookup returns the other tenant's row.

const prismaMock = vi.hoisted(() => ({
  certificate: { findFirst: vi.fn(), update: vi.fn() },
  event: { findFirst: vi.fn() },
  announcement: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
  registration: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
}))
const authMock = vi.hoisted(() => vi.fn())
const authorizeMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/authorization", () => ({ authorize: authorizeMock }))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => ({ success: true })) }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }),
}))

import { selectedRowsOf } from "@/components/tables/DataTable"
import { parseListParams, parseEnumParam } from "@/lib/list-params"
import { orgPaymentWhere, parsePaymentFilters } from "@/lib/org-payments"
import { orgProfileSchema, normalizeProfileInput, orgColumnsFromUpdate, orgProfileFromRecord } from "@/lib/org-profile"
import { readPendingInvites } from "@/lib/org-invites"
import { draftInputSchema, readDrafts, recipientFilterSchema } from "@/lib/org-communications"
import { escapeHtml, textToHtml } from "@/lib/escape-html"
import { toCsv } from "@/lib/csv-export"
import * as certificateRoute from "@/app/api/admin/org/[orgId]/certificates/[certificateId]/route"
import * as announcementsRoute from "@/app/api/admin/org/[orgId]/announcements/route"
import * as announcementRoute from "@/app/api/admin/org/[orgId]/announcements/[announcementId]/route"

const ORG_A = "org_a"
const ORG_B = "org_b"

describe("DataTable selection", () => {
  it("maps a selection state to the selected rows of the current data", () => {
    const data = [{ id: "a" }, { id: "b" }, { id: "c" }]
    expect(selectedRowsOf(data, { "0": true, "2": true })).toEqual([{ id: "a" }, { id: "c" }])
    expect(selectedRowsOf(data, { "1": false })).toEqual([])
    // a stale index past the end of a shorter page is dropped, not returned as undefined
    expect(selectedRowsOf(data, { "7": true })).toEqual([])
  })
})

describe("list params", () => {
  it("clamps page and limit and trims the search", () => {
    const p = parseListParams(new URLSearchParams("page=-3&limit=99999&search=%20%20alice%20"), { defaultLimit: 10, maxLimit: 100 })
    expect(p).toEqual({ page: 1, limit: 100, skip: 0, search: "alice" })
    expect(parseListParams(new URLSearchParams("page=abc&search=%20")).search).toBeUndefined()
    expect(parseListParams(new URLSearchParams("page=3&limit=20")).skip).toBe(40)
  })
  it("drops enum values it doesn't know", () => {
    expect(parseEnumParam(new URLSearchParams("status=COMPLETED"), "status", ["COMPLETED", "PENDING"])).toBe("COMPLETED")
    expect(parseEnumParam(new URLSearchParams("status=DROP TABLE"), "status", ["COMPLETED", "PENDING"])).toBeUndefined()
  })
})

describe("payment filters", () => {
  it("always scopes to the organization and only narrows within it", () => {
    const where = orgPaymentWhere(ORG_A, { search: "kavya", status: "COMPLETED" })
    expect(where.registration).toEqual({ event: { organizationId: ORG_A, deletedAt: null } })
    expect(where.status).toBe("COMPLETED")
    expect(Array.isArray(where.OR)).toBe(true)
    expect(orgPaymentWhere(ORG_A, {}).OR).toBeUndefined()
  })
  it("parses the list's filters for the export", () => {
    expect(parsePaymentFilters(new URLSearchParams("search=x&status=REFUNDED"))).toEqual({ search: "x", status: "REFUNDED" })
    expect(parsePaymentFilters(new URLSearchParams("status=bogus"))).toEqual({ search: undefined, status: undefined })
  })
})

describe("CSV export", () => {
  it("neutralises spreadsheet formulas in participant-supplied cells", () => {
    const csv = toCsv(["Name", "Amount"], [["=HYPERLINK(\"http://x\")", -5], ["@SUM(A1)", 10], ["+1", 1]])
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(csv).toContain(`"'@SUM(A1)"`)
    expect(csv).toContain(`"'+1"`)
    expect(csv).toContain(`"-5"`) // a real number stays a number
  })
})

describe("org settings form", () => {
  it("accepts the form exactly as GET returned it (read-only enterpriseId included)", () => {
    const loaded = orgProfileFromRecord({ name: "Tech Club", category: null, description: null, email: "tech@x.edu", phone: null, website: null, address: null, city: null, state: null, socialLinks: null, settings: null } as never)
    const parsed = orgProfileSchema.safeParse(normalizeProfileInput({ ...loaded, enterpriseId: "ent_1" }))
    expect(parsed.success).toBe(true)
    // other unknown keys are still refused
    expect(orgProfileSchema.safeParse(normalizeProfileInput({ ...loaded, isActive: false })).success).toBe(false)
  })

  it("validates tax ids, links and phone, upper-casing tax ids", () => {
    const ok = orgProfileSchema.safeParse(
      normalizeProfileInput({ billing: { gstin: "29abcde1234f1z5", pan: "abcde1234f", pinCode: "560001" }, website: "https://club.example" })
    )
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.billing).toEqual({ gstin: "29ABCDE1234F1Z5", pan: "ABCDE1234F", pinCode: "560001" })

    const bad = orgProfileSchema.safeParse({ billing: { gstin: "123" }, website: "javascript:alert(1)", phone: "call me" })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      const paths = bad.error.issues.map((i) => i.path.join("."))
      expect(paths).toEqual(expect.arrayContaining(["billing.gstin", "website", "phone"]))
    }
  })
  it("rejects fields it doesn't own (no raw settings JSON)", () => {
    expect(orgProfileSchema.safeParse({ settings: { anything: true } }).success).toBe(false)
  })
  it("stores blank optional text as null and keeps required fields", () => {
    expect(orgColumnsFromUpdate({ name: "Club", city: "", website: "" })).toEqual({ name: "Club", city: null, website: null })
  })
  it("reads the form back from the record, ignoring unknown JSON", () => {
    const profile = orgProfileFromRecord({
      name: "Club", category: null, description: null, email: "c@x.test", phone: null, website: null,
      address: null, city: null, state: null,
      socialLinks: { twitter: "https://x.com/c", facebook: "https://fb.com/c" },
      settings: { billing: { gstin: "G" }, eventDefaults: { requireApproval: true }, pendingInvites: [{ email: "x" }] },
    })
    expect(profile.socialLinks).toEqual({ twitter: "https://x.com/c", instagram: "", linkedin: "" })
    expect(profile.billing).toEqual({ gstin: "G", pan: "", pinCode: "" })
    expect(profile.eventDefaults).toEqual({ requireApproval: true, autoGenerateCertificates: false })
    expect(profile).not.toHaveProperty("pendingInvites")
  })
})

describe("settings-backed lists", () => {
  it("reads only well-formed pending invites and drafts", () => {
    const settings = {
      pendingInvites: [{ email: "a@x.test", role: "VIEWER", invitedAt: "2026-11-09T00:00:00Z" }, { email: 5 }],
      communicationDrafts: [
        { id: "d_abcdef12", subject: "S", body: "B", recipientFilter: { type: "all" }, updatedAt: "2026-11-09T00:00:00Z" },
        "junk",
      ],
    }
    expect(readPendingInvites(settings)).toHaveLength(1)
    expect(readDrafts(settings)).toHaveLength(1)
    expect(readPendingInvites(null)).toEqual([])
  })
  it("requires something to save and a valid audience", () => {
    expect(draftInputSchema.safeParse({ subject: "", body: "  " }).success).toBe(false)
    expect(draftInputSchema.safeParse({ subject: "Hi" }).success).toBe(true)
    expect(recipientFilterSchema.safeParse({ type: "by_event" }).success).toBe(false)
    expect(recipientFilterSchema.safeParse({ type: "by_status", statuses: ["HACKED"] }).success).toBe(false)
    expect(recipientFilterSchema.safeParse({ type: "by_status", statuses: ["CONFIRMED"] }).success).toBe(true)
  })
})

describe("escaping", () => {
  it("escapes HTML and keeps line breaks for typed text", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;")
    expect(textToHtml("a<b>\nc")).toBe("a&lt;b&gt;<br/>c")
  })
})

// ---------------------------------------------------------------------------
// Route-level tenant scoping
// ---------------------------------------------------------------------------

type Where = Record<string, unknown>
const CERTS = [
  { id: "cert_a", orgId: ORG_A, status: "GENERATED", downloadedAt: null, metadata: null, certificateNumber: "CERT-A", eventId: "event_a", userId: "u1" },
  { id: "cert_b", orgId: ORG_B, status: "GENERATED", downloadedAt: null, metadata: null, certificateNumber: "CERT-B", eventId: "event_b", userId: "u2" },
]
const EVENTS = [
  { id: "event_a", organizationId: ORG_A, title: "Event A", organization: { name: "Org A" } },
  { id: "event_b", organizationId: ORG_B, title: "Event B", organization: { name: "Org B" } },
]
const ANNOUNCEMENTS = [
  { id: "ann_b", orgId: ORG_B, eventId: "event_b", title: "B news", content: "x", publishedAt: null, event: { title: "Event B", organization: { name: "Org B" } } },
]
const eventOrg = (where: Where) => (where.event as Where | undefined)?.organizationId

function req(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}
const ctx = <T,>(params: T) => ({ params: Promise.resolve(params) })

beforeEach(() => {
  vi.clearAllMocks()
  // alice is an org admin of org_a only
  authMock.mockResolvedValue({ user: { id: "alice", name: "Alice" } })
  authorizeMock.mockImplementation(async (_u: string, _p: unknown, context?: Where) =>
    context?.organizationId === ORG_A ? { authorized: true, role: "ORG_ADMIN" } : { authorized: false, message: "nope" }
  )
  prismaMock.certificate.findFirst.mockImplementation(async ({ where }: { where: Where }) =>
    CERTS.find((c) => c.id === where.id && (eventOrg(where) === undefined || c.orgId === eventOrg(where))) ?? null
  )
  prismaMock.certificate.update.mockImplementation(async ({ data }: { data: Where }) => ({ status: data.status ?? "GENERATED", metadata: data.metadata }))
  prismaMock.event.findFirst.mockImplementation(async ({ where }: { where: Where }) =>
    EVENTS.find((e) => e.id === where.id && (where.organizationId === undefined || e.organizationId === where.organizationId)) ?? null
  )
  prismaMock.announcement.findFirst.mockImplementation(async ({ where }: { where: Where }) =>
    ANNOUNCEMENTS.find((a) => a.id === where.id && (eventOrg(where) === undefined || a.orgId === eventOrg(where))) ?? null
  )
  prismaMock.announcement.create.mockImplementation(async ({ data }: { data: Where }) => ({ id: "new", ...data }))
  prismaMock.registration.findMany.mockResolvedValue([])
})

describe("certificate revoke is scoped to the authorized organization", () => {
  it("revokes its own organization's certificate", async () => {
    const res = await certificateRoute.PATCH(req("/x", "PATCH", { action: "revoke" }), ctx({ orgId: ORG_A, certificateId: "cert_a" }))
    expect(res.status).toBe(200)
    const data = prismaMock.certificate.update.mock.calls[0][0].data
    // the issued status is kept: PENDING means "not issued yet", never "revoked"
    expect(data.status).toBeUndefined()
    expect(data.metadata).toMatchObject({ revokedAt: expect.any(String), revokedBy: "alice" })
    expect((await res.json()).data.status).toBe("REVOKED")
  })
  it("stores an optional reason and refuses to revoke twice", async () => {
    await certificateRoute.PATCH(req("/x", "PATCH", { action: "revoke", reason: "Duplicate" }), ctx({ orgId: ORG_A, certificateId: "cert_a" }))
    expect(prismaMock.certificate.update.mock.calls[0][0].data.metadata.revokedReason).toBe("Duplicate")
    prismaMock.certificate.findFirst.mockResolvedValueOnce({ ...CERTS[0], metadata: { revokedAt: "2026-11-01T00:00:00.000Z" } })
    const again = await certificateRoute.PATCH(req("/x", "PATCH", { action: "revoke" }), ctx({ orgId: ORG_A, certificateId: "cert_a" }))
    expect(again.status).toBe(409)
  })
  it("restores a revoked certificate by clearing the revocation", async () => {
    prismaMock.certificate.findFirst.mockResolvedValueOnce({ ...CERTS[0], status: "SENT", metadata: { revokedAt: "2026-11-01T00:00:00.000Z", revokedBy: "alice", keep: 1 } })
    const res = await certificateRoute.PATCH(req("/x", "PATCH", { action: "restore" }), ctx({ orgId: ORG_A, certificateId: "cert_a" }))
    expect(res.status).toBe(200)
    expect(prismaMock.certificate.update.mock.calls[0][0].data).toEqual({ status: "SENT", metadata: { keep: 1 } })
    expect((await res.json()).data.status).toBe("SENT")
  })
  it("won't restore a certificate that isn't revoked", async () => {
    const res = await certificateRoute.PATCH(req("/x", "PATCH", { action: "restore" }), ctx({ orgId: ORG_A, certificateId: "cert_a" }))
    expect(res.status).toBe(409)
  })
  it("treats another organization's certificate id as not found", async () => {
    const res = await certificateRoute.PATCH(req("/x", "PATCH", { action: "revoke" }), ctx({ orgId: ORG_A, certificateId: "cert_b" }))
    expect(res.status).toBe(404)
    expect(prismaMock.certificate.update).not.toHaveBeenCalled()
  })
  it("refuses an organization the caller has no role in", async () => {
    const res = await certificateRoute.PATCH(req("/x", "PATCH", { action: "revoke" }), ctx({ orgId: ORG_B, certificateId: "cert_b" }))
    expect(res.status).toBe(403)
  })
})

describe("announcements are scoped to the authorized organization", () => {
  it("won't post to another organization's event", async () => {
    const res = await announcementsRoute.POST(
      req("/x", "POST", { eventId: "event_b", title: "t", content: "c" }),
      ctx({ orgId: ORG_A })
    )
    expect(res.status).toBe(404)
    expect(prismaMock.announcement.create).not.toHaveBeenCalled()
  })
  it("saves a draft for its own event without notifying anyone", async () => {
    const res = await announcementsRoute.POST(
      req("/x", "POST", { eventId: "event_a", title: "t", content: "c", publish: false }),
      ctx({ orgId: ORG_A })
    )
    expect(res.status).toBe(201)
    expect(prismaMock.announcement.create.mock.calls[0][0].data.publishedAt).toBeNull()
    expect(prismaMock.registration.findMany).not.toHaveBeenCalled()
  })
  it("won't list another organization's announcements", async () => {
    const res = await announcementsRoute.GET(req("/x", "GET"), ctx({ orgId: ORG_B }))
    expect(res.status).toBe(403)
  })
  it("won't publish or delete another organization's announcement", async () => {
    const publish = await announcementRoute.PATCH(req("/x", "PATCH", { action: "publish" }), ctx({ orgId: ORG_A, announcementId: "ann_b" }))
    expect(publish.status).toBe(404)
    const del = await announcementRoute.DELETE(req("/x", "DELETE"), ctx({ orgId: ORG_A, announcementId: "ann_b" }))
    expect(del.status).toBe(404)
    expect(prismaMock.announcement.delete).not.toHaveBeenCalled()
  })
})

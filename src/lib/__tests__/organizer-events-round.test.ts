import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Organizer events / registrations / communications fixes: event limit on create and
// duplicate, schedule validation, paid-publish gate, publish audit scope, cancel
// notifications, registration export, recipient count, certificate preview, public
// announcements. Prisma, auth and the side-effect libraries are mocked.
const prismaMock = vi.hoisted(() => ({
  event: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  organization: { findUnique: vi.fn() },
  subscription: { findFirst: vi.fn() },
  ticketType: { count: vi.fn() },
  registration: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  ticket: { updateMany: vi.fn() },
  payment: { updateMany: vi.fn(), aggregate: vi.fn() },
  customFormField: { findMany: vi.fn() },
  certificate: { groupBy: vi.fn() },
  certificateTemplate: { findMany: vi.fn() },
  announcement: { findMany: vi.fn() },
  organizationMember: { findFirst: vi.fn() },
  enterpriseMember: { findFirst: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}))
const authMock = vi.hoisted(() => vi.fn())
const authorizeMock = vi.hoisted(() => vi.fn())
const auditMock = vi.hoisted(() => vi.fn())
const bulkNotifyMock = vi.hoisted(() => vi.fn())
const queueMock = vi.hoisted(() => vi.fn())
const razorpayConfigured = vi.hoisted(() => vi.fn())
const platformSettings = vi.hoisted(() => vi.fn())
const refundAllMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/authorization", () => ({ authorize: authorizeMock }))
vi.mock("@/lib/audit", () => ({ createAuditLog: auditMock, getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }) }))
vi.mock("@/lib/notifications", () => ({ createBulkNotifications: bulkNotifyMock }))
vi.mock("@/lib/email-queue", () => ({ emailQueue: { queueBulkEmails: queueMock }, replaceMergeTags: (s: string) => s }))
vi.mock("@/lib/razorpay", () => ({ isRazorpayConfigured: razorpayConfigured }))
vi.mock("@/lib/platform-settings-store", () => ({ getActivePlatformSettings: platformSettings }))
vi.mock("@/lib/org-refund", () => ({ refundAllForEvent: refundAllMock }))

import * as eventsRoute from "@/app/api/admin/org/[orgId]/events/route"
import * as eventRoute from "@/app/api/admin/org/[orgId]/events/[eventId]/route"
import * as duplicateRoute from "@/app/api/admin/org/[orgId]/events/[eventId]/duplicate/route"
import * as recurrencesRoute from "@/app/api/admin/org/[orgId]/events/[eventId]/generate-recurrences/route"
import * as publishRoute from "@/app/api/admin/org/[orgId]/events/[eventId]/publish/route"
import * as cancelRoute from "@/app/api/admin/org/[orgId]/events/[eventId]/cancel/route"
import * as exportRoute from "@/app/api/admin/org/[orgId]/registrations/export/route"
import * as recipientsRoute from "@/app/api/admin/org/[orgId]/communications/recipients/route"
import * as pendingCertsRoute from "@/app/api/admin/org/[orgId]/certificates/pending/route"
import * as announcementsRoute from "@/app/api/events/[slug]/announcements/route"
import { eventScheduleIssues } from "@/lib/validations/event"
import { fromZonedInputValue, toZonedInputValue, zoneNote, zoneDiffersFromViewer } from "@/lib/event-time"
import { slugify } from "@/lib/utils"
import { buildPublicEventsWhere, priceLabel, priceSummary, publicEventsOrderBy, publicEventsQuerySchema } from "@/lib/public-events"
import { draftInputSchema } from "@/lib/org-communications"

const ORG = "org_a"
const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json" } })
const ctx = <T,>(params: T) => ({ params: Promise.resolve(params) })

const validEvent = (over: Record<string, unknown> = {}) => ({
  title: "Tech Fest", slug: "tech-fest", shortDescription: "A short description",
  description: "x".repeat(60), type: "SINGLE", category: "TECH", visibility: "PUBLIC",
  startDate: "2027-01-10T10:00:00.000Z", endDate: "2027-01-10T12:00:00.000Z",
  ticketTypes: [{ name: "General", price: 0 }],
  ...over,
})

beforeEach(() => {
  vi.resetAllMocks()
  authMock.mockResolvedValue({ user: { id: "user_alice", name: "Alice" } })
  authorizeMock.mockImplementation(async (_u: string, _p: unknown, c?: { organizationId?: string }) =>
    c?.organizationId === ORG ? { authorized: true, role: "ORG_ADMIN" } : { authorized: false, message: "Forbidden" })
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock))
  razorpayConfigured.mockReturnValue(true)
  platformSettings.mockResolvedValue({ features: { paymentProcessing: true } })
  bulkNotifyMock.mockResolvedValue({ created: 0 })
})

describe("event limit on create and duplicate (item 1)", () => {
  beforeEach(() => {
    // Tech Club belongs to an enterprise on FREE (no subscription): limit 5, enterprise-wide
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: "ent_1", enterprise: { settings: {} } })
    prismaMock.subscription.findFirst.mockResolvedValue(null)
  })

  it("lets an enterprise org create while the enterprise has created fewer than 5 events this month", async () => {
    prismaMock.event.count.mockResolvedValue(4)
    prismaMock.event.findUnique.mockResolvedValue(null)
    prismaMock.event.create.mockResolvedValue({ id: "ev_new", title: "Tech Fest" })

    const res = await eventsRoute.POST(req(`/api/admin/org/${ORG}/events`, "POST", validEvent()), ctx({ orgId: ORG }))

    expect(res.status).toBe(201)
    // counted enterprise-wide, created since the 1st, cancelled / deleted events left out
    const where = prismaMock.event.count.mock.calls[0][0].where
    expect(where.OR).toEqual([{ enterpriseId: "ent_1" }, { organization: { enterpriseId: "ent_1" } }])
    expect(where.status).toEqual({ not: "CANCELLED" })
    expect(where.deletedAt).toBeNull()
    const now = new Date()
    expect(where.createdAt).toEqual({ gte: new Date(now.getFullYear(), now.getMonth(), 1) })
  })

  it("refuses create at the limit with the monthly count, reset date and upgrade path", async () => {
    prismaMock.event.count.mockResolvedValue(5)
    const res = await eventsRoute.POST(req(`/api/admin/org/${ORG}/events`, "POST", validEvent()), ctx({ orgId: ORG }))
    const json = await res.json()
    expect(res.status).toBe(403)
    expect(json.message).toContain("You've created 5 of 5 events this month on the Free plan")
    expect(json.message).toContain("The count resets on 1 ")
    expect(json.message).toContain("ask an enterprise admin to upgrade to Pro")
    expect(prismaMock.event.create).not.toHaveBeenCalled()
  })

  it("applies the same limit to Duplicate", async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: "ev_1", slug: "a", title: "A", ticketTypes: [], customFormFields: [], faqs: [], sponsors: [] })
    prismaMock.event.count.mockResolvedValue(5)

    const res = await duplicateRoute.POST(req(`/api/admin/org/${ORG}/events/ev_1/duplicate`, "POST"), ctx({ orgId: ORG, eventId: "ev_1" }))

    expect(res.status).toBe(403)
    expect((await res.json()).message).toContain("5 of 5 events this month")
    expect(prismaMock.event.create).not.toHaveBeenCalled()
  })

  it("refuses a recurrence series that wouldn't fit this month, creating none of it", async () => {
    prismaMock.event.findFirst.mockResolvedValue({
      id: "ev_1", slug: "weekly", title: "Weekly", settings: { recurrencePattern: "WEEKLY", recurrenceCount: 4 },
      startDate: new Date("2027-01-10T10:00:00Z"), endDate: new Date("2027-01-10T12:00:00Z"),
    })
    prismaMock.event.count.mockResolvedValue(3) // 3 + 3 repeats > 5

    const res = await recurrencesRoute.POST(req(`/api/admin/org/${ORG}/events/ev_1/generate-recurrences`, "POST"), ctx({ orgId: ORG, eventId: "ev_1" }))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.message).toContain("Couldn't create the 3 repeats of this event; none were created.")
    expect(json.message).toContain("You've created 3 of 5 events this month")
    expect(json.data).toMatchObject({ used: 3, limit: 5, requested: 3 })
    expect(prismaMock.event.create).not.toHaveBeenCalled()
  })

  it("creates the whole series when it fits", async () => {
    prismaMock.event.findFirst.mockResolvedValue({
      id: "ev_1", slug: "weekly", title: "Weekly", settings: { recurrencePattern: "WEEKLY", recurrenceCount: 3 },
      startDate: new Date("2027-01-10T10:00:00Z"), endDate: new Date("2027-01-10T12:00:00Z"),
    })
    prismaMock.event.count.mockResolvedValue(3) // 3 + 2 repeats = 5
    prismaMock.event.findUnique.mockResolvedValue(null)
    prismaMock.event.create.mockImplementation(async ({ data }: { data: { slug: string } }) => ({ id: `id_${data.slug}` }))

    const res = await recurrencesRoute.POST(req(`/api/admin/org/${ORG}/events/ev_1/generate-recurrences`, "POST"), ctx({ orgId: ORG, eventId: "ev_1" }))

    expect(res.status).toBe(200)
    expect(prismaMock.event.create).toHaveBeenCalledTimes(2)
  })
})

describe("the enterprise's reject reason on the organizer's event pages", () => {
  const rejected = { approvalDecision: { status: "REJECTED", reason: "Add the venue permit", decidedAt: "2026-11-08T10:00:00.000Z", decidedById: "u_ent", decidedByName: "Priya" }, isTemplate: false }
  const row = (over: Record<string, unknown>) => ({
    id: "ev_1", title: "Tech Fest", status: "DRAFT", startDate: new Date("2027-01-10T10:00:00Z"), endDate: new Date("2027-01-10T12:00:00Z"),
    createdAt: new Date("2026-11-01T00:00:00Z"), settings: rejected, ...over,
  })

  it("the events list carries the reason on a rejected draft only, and never the raw settings", async () => {
    prismaMock.event.findMany.mockResolvedValue([
      row({}),
      row({ id: "ev_2", status: "PENDING_APPROVAL" }), // resubmitted: the old decision no longer applies
      row({ id: "ev_3", settings: null }),
      row({ id: "ev_4", createdAt: new Date("2026-11-09T00:00:00Z") }), // a Duplicate made after the decision copied it
    ])
    prismaMock.event.count.mockResolvedValue(4)
    prismaMock.event.groupBy.mockResolvedValue([])
    prismaMock.organization.findUnique.mockResolvedValue({ enterprise: { name: "Acme University", settings: { requireEventApproval: true } } })

    const json = await (await eventsRoute.GET(req(`/api/admin/org/${ORG}/events`), ctx({ orgId: ORG }))).json()

    expect(json.data[0].approvalRejection).toEqual({
      reason: "Add the venue permit", decidedAt: "2026-11-08T10:00:00.000Z", decidedByName: "Priya", enterpriseName: "Acme University",
    })
    expect(json.data[1].approvalRejection).toBeNull()
    expect(json.data[2].approvalRejection).toBeNull()
    expect(json.data[3].approvalRejection).toBeNull()
    expect(json.data[0].settings).toBeUndefined()
  })

  it("the event detail carries it too", async () => {
    prismaMock.event.findFirst.mockResolvedValue({ ...row({}), organization: { name: "Tech Club", logo: null, enterprise: { name: "Acme University" } } })
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null, refundAmount: null } })

    const json = await (await eventRoute.GET(req(`/api/admin/org/${ORG}/events/ev_1`), ctx({ orgId: ORG, eventId: "ev_1" }))).json()

    expect(json.data.approvalRejection).toMatchObject({ reason: "Add the venue permit", enterpriseName: "Acme University" })
  })
})

describe("schedule validation (item 3)", () => {
  it("rejects an end before the start and a registration window past the end", () => {
    const start = new Date("2027-01-10T10:00:00Z")
    expect(eventScheduleIssues({ startDate: start, endDate: new Date("2027-01-10T09:00:00Z") })[0]).toMatchObject({ path: "endDate" })
    expect(eventScheduleIssues({ startDate: start, endDate: start })).toHaveLength(1)
    expect(eventScheduleIssues({
      startDate: start, endDate: new Date("2027-01-10T12:00:00Z"), registrationEndDate: new Date("2027-01-11T00:00:00Z"),
    })[0]).toMatchObject({ path: "registrationEndDate" })
    expect(eventScheduleIssues({ startDate: start, endDate: new Date("2027-01-10T12:00:00Z"), registrationEndDate: start })).toEqual([])
  })

  it("the create route answers 400 with the rule, before anything is written", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: null })
    prismaMock.subscription.findFirst.mockResolvedValue(null)
    prismaMock.event.count.mockResolvedValue(0)
    const res = await eventsRoute.POST(
      req(`/api/admin/org/${ORG}/events`, "POST", validEvent({ endDate: "2027-01-09T10:00:00.000Z" })),
      ctx({ orgId: ORG })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe("The event must end after it starts")
    expect(prismaMock.event.create).not.toHaveBeenCalled()
  })

  it("the update route checks the window against the stored dates", async () => {
    prismaMock.event.findFirst.mockResolvedValue({
      id: "ev_1", title: "A", status: "DRAFT", slug: "a", settings: null, enterpriseId: null,
      startDate: new Date("2027-01-10T10:00:00Z"), endDate: new Date("2027-01-10T12:00:00Z"),
      registrationStartDate: null, registrationEndDate: null,
    })
    const res = await eventRoute.PATCH(
      req(`/api/admin/org/${ORG}/events/ev_1`, "PATCH", { registrationEndDate: "2027-01-12T00:00:00.000Z" }),
      ctx({ orgId: ORG, eventId: "ev_1" })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain("Registration must close by the time the event ends")
    expect(prismaMock.event.update).not.toHaveBeenCalled()
  })

  it("slugs keep their hyphens", () => {
    expect(slugify("Tech-Fest 2026")).toBe("tech-fest-2026")
    expect(slugify("  AI / ML -- Workshop_1!  ")).toBe("ai-ml-workshop-1")
    expect(slugify("Café Night")).toBe("cafe-night")
  })
})

describe("publishing (items 5 and 6)", () => {
  beforeEach(() => {
    prismaMock.event.findFirst.mockResolvedValue({ title: "Paid Night", status: "DRAFT", startDate: new Date(), endDate: new Date() })
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: "ent_1", enterprise: { settings: { requireEventApproval: true } } })
  })

  it("refuses to publish paid tickets while payments are switched off", async () => {
    platformSettings.mockResolvedValue({ features: { paymentProcessing: false } })
    prismaMock.ticketType.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1)

    const res = await publishRoute.POST(req(`/api/admin/org/${ORG}/events/ev_1/publish`, "POST"), ctx({ orgId: ORG, eventId: "ev_1" }))

    expect(res.status).toBe(409)
    expect((await res.json()).message).toContain("switched off")
    expect(prismaMock.event.update).not.toHaveBeenCalled()
  })

  it("refuses to publish paid tickets when Razorpay isn't configured", async () => {
    razorpayConfigured.mockReturnValue(false)
    prismaMock.ticketType.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    const res = await publishRoute.POST(req(`/api/admin/org/${ORG}/events/ev_1/publish`, "POST"), ctx({ orgId: ORG, eventId: "ev_1" }))
    expect(res.status).toBe(409)
    expect((await res.json()).message).toContain("aren't set up")
  })

  it("free events still publish with payments off, and the submission is audited for the enterprise", async () => {
    platformSettings.mockResolvedValue({ features: { paymentProcessing: false } })
    prismaMock.ticketType.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
    // alice can't approve for the enterprise: the event goes to approval
    authorizeMock.mockImplementation(async (_u: string, _p: unknown, c?: { organizationId?: string }) =>
      c?.organizationId === ORG ? { authorized: true, role: "ORG_ADMIN" } : { authorized: false, message: "Forbidden" })
    prismaMock.enterpriseMember.findMany.mockResolvedValue([])

    const res = await publishRoute.POST(req(`/api/admin/org/${ORG}/events/ev_1/publish`, "POST"), ctx({ orgId: ORG, eventId: "ev_1" }))

    expect(res.status).toBe(200)
    expect((await res.json()).data.status).toBe("PENDING_APPROVAL")
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "UPDATE", organizationId: ORG, enterpriseId: "ent_1", eventId: "ev_1" }))
  })
})

describe("cancelling an event (item 4)", () => {
  beforeEach(() => {
    prismaMock.event.findFirst.mockResolvedValue({ title: "Tech Fest", status: "PUBLISHED", enterpriseId: null, organization: { name: "Tech Club" } })
    prismaMock.registration.findMany.mockResolvedValue([
      { userId: "u1", user: { name: "Kavya", email: "kavya@x.test" } },
      { userId: "u2", user: { name: "Ravi", email: "ravi@x.test" } },
    ])
  })

  it("notifies every active registrant in-app and by email, with the reason", async () => {
    prismaMock.event.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
    prismaMock.registration.count.mockResolvedValue(1) // one already checked in
    const res = await cancelRoute.POST(
      req(`/api/admin/org/${ORG}/events/ev_1/cancel`, "POST", { reason: "Venue flooded" }),
      ctx({ orgId: ORG, eventId: "ev_1" })
    )
    expect(res.status).toBe(200)
    expect((await res.json()).data.notified).toBe(2)
    expect(prismaMock.registration.findMany.mock.calls[0][0].where.status.in).toEqual(["PENDING", "CONFIRMED", "WAITLISTED", "CHECKED_IN"])
    // their tickets are voided and only check-ins still hold a seat
    expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CANCELLED" } }))
    expect(prismaMock.event.update).toHaveBeenCalledWith({ where: { id: "ev_1" }, data: { currentRegistrations: 1 } })
    expect(bulkNotifyMock).toHaveBeenCalledWith(["u1", "u2"], expect.objectContaining({ message: expect.stringContaining("Venue flooded"), eventId: "ev_1" }))
    const emails = queueMock.mock.calls[0][0]
    expect(emails.map((e: { to: string }) => e.to)).toEqual(["kavya@x.test", "ravi@x.test"])
    expect(emails[0].html).toContain("Venue flooded")
  })

  it("refunds everyone who paid by default and tells them their money is on its way", async () => {
    prismaMock.event.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
    prismaMock.registration.count.mockResolvedValue(0)
    refundAllMock.mockResolvedValue({ attempted: 2, refunded: 2, failed: [], remaining: 0 })
    const res = await cancelRoute.POST(
      req(`/api/admin/org/${ORG}/events/ev_1/cancel`, "POST", { reason: "Venue flooded" }),
      ctx({ orgId: ORG, eventId: "ev_1" })
    )
    const json = await res.json()
    expect(refundAllMock).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG, eventId: "ev_1", reason: "Event cancelled: Venue flooded" }))
    expect(json.data.refunds).toEqual({ refunded: 2, failed: 0, remaining: 0 })
    expect(json.message).toContain("2 payments refunded")
    expect(queueMock.mock.calls[0][0][0].html).toContain("has been refunded")
  })

  it("reports refunds that didn't go through and doesn't promise them in the email", async () => {
    prismaMock.event.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
    prismaMock.registration.count.mockResolvedValue(0)
    refundAllMock.mockResolvedValue({ attempted: 2, refunded: 1, failed: [{ paymentId: "p2", message: "Insufficient balance" }], remaining: 1 })
    const json = await (await cancelRoute.POST(
      req(`/api/admin/org/${ORG}/events/ev_1/cancel`, "POST", { reason: "Venue flooded" }),
      ctx({ orgId: ORG, eventId: "ev_1" })
    )).json()
    expect(json.message).toContain("1 payment still to refund")
    expect(queueMock.mock.calls[0][0][0].html).toContain("the organizer will refund you")
  })

  it("skips refunds when the organizer unticks the box", async () => {
    prismaMock.event.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
    prismaMock.registration.count.mockResolvedValue(0)
    await cancelRoute.POST(
      req(`/api/admin/org/${ORG}/events/ev_1/cancel`, "POST", { reason: "Venue flooded", refundPayments: false }),
      ctx({ orgId: ORG, eventId: "ev_1" })
    )
    expect(refundAllMock).not.toHaveBeenCalled()
  })

  it("notifies only once when two cancels race", async () => {
    prismaMock.event.updateMany.mockResolvedValue({ count: 0 }) // the other request won
    const res = await cancelRoute.POST(
      req(`/api/admin/org/${ORG}/events/ev_1/cancel`, "POST", { reason: "Venue flooded" }),
      ctx({ orgId: ORG, eventId: "ev_1" })
    )
    expect(res.status).toBe(400)
    expect(bulkNotifyMock).not.toHaveBeenCalled()
    expect(queueMock).not.toHaveBeenCalled()
  })
})

describe("registration export (item 2)", () => {
  it("adds the form answers as formula-safe columns and audits the export", async () => {
    prismaMock.registration.findMany.mockResolvedValue([
      {
        registrationNumber: "R-1", status: "CONFIRMED", createdAt: new Date("2026-11-01T00:00:00Z"), source: null,
        formResponses: { name: "Kavya", phone: "+91 98765 43210", organization: "=HYPERLINK(\"x\")", department: "CSE", "T-shirt size": "M", Interests: ["AI", "Web"], "Old question": "kept" },
        user: { name: "Kavya", email: "kavya@x.test", phone: null },
        event: { title: "Tech Fest" }, ticketType: { name: "General" }, payment: null,
      },
    ])
    prismaMock.customFormField.findMany.mockResolvedValue([{ label: "T-shirt size" }, { label: "Interests" }])
    prismaMock.organization.findUnique.mockResolvedValue({ enterpriseId: "ent_1" })

    const res = await exportRoute.GET(req(`/api/admin/org/${ORG}/registrations/export?eventId=ev_1`), ctx({ orgId: ORG }))
    const csv = await res.text()
    const [header, row] = csv.replace(/^﻿/, "").split("\r\n")

    expect(header).toContain('"Organization","Department"')
    expect(header).toMatch(/"T-shirt size","Interests","Old question"$/)
    expect(row).toContain('"+91 98765 43210"'.replace('"+', "\"'+")) // a leading + is defused too
    expect(row).toContain("\"'=HYPERLINK(\"\"x\"\")\"")
    expect(row).toContain('"AI; Web"')
    expect(prismaMock.customFormField.findMany.mock.calls[0][0].where.event).toMatchObject({ organizationId: ORG, id: "ev_1" })
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "EXPORT", entityType: "REGISTRATION", organizationId: ORG, enterpriseId: "ent_1", eventId: "ev_1" }))
  })
})

describe("communications recipients (item 7)", () => {
  it("counts unique addresses inside the organization, without sending", async () => {
    prismaMock.registration.findMany.mockResolvedValue([
      { userId: "u1", registrationNumber: "R1", user: { name: "A", email: "a@x.test" }, event: { title: "E" } },
      { userId: "u1", registrationNumber: "R2", user: { name: "A", email: "a@x.test" }, event: { title: "F" } },
      { userId: "u2", registrationNumber: "R3", user: { name: "B", email: "b@x.test" }, event: { title: "E" } },
    ])
    const res = await recipientsRoute.POST(req(`/api/admin/org/${ORG}/communications/recipients`, "POST", { recipientFilter: { type: "all" } }), ctx({ orgId: ORG }))
    expect((await res.json()).data.count).toBe(2)
    expect(prismaMock.registration.findMany.mock.calls[0][0].where.event).toEqual({ organizationId: ORG, deletedAt: null })
    expect(queueMock).not.toHaveBeenCalled()
  })

  it("needs a chosen audience; drafts may be saved without one (no 'all' default)", async () => {
    const res = await recipientsRoute.POST(req(`/api/admin/org/${ORG}/communications/recipients`, "POST", {}), ctx({ orgId: ORG }))
    expect(res.status).toBe(400)
    expect(draftInputSchema.parse({ subject: "Hi" }).recipientFilter).toBeUndefined()
  })

  it("is refused outside your organization", async () => {
    const res = await recipientsRoute.POST(req(`/api/admin/org/org_b/communications/recipients`, "POST", { recipientFilter: { type: "all" } }), ctx({ orgId: "org_b" }))
    expect(res.status).toBe(403)
  })
})

describe("certificate generation preview (item 8)", () => {
  it("reports how many would be generated with and without no-shows", async () => {
    prismaMock.event.findMany.mockResolvedValue([{ id: "ev_1", title: "Done", endDate: new Date("2026-10-01"), status: "COMPLETED" }])
    prismaMock.registration.groupBy
      .mockResolvedValueOnce([{ eventId: "ev_1", _count: { _all: 10 } }]) // eligible
      .mockResolvedValueOnce([{ status: "CHECKED_IN", _count: { _all: 6 } }, { status: "CONFIRMED", _count: { _all: 3 } }]) // missing a certificate
    prismaMock.certificate.groupBy.mockResolvedValue([{ eventId: "ev_1", _count: { _all: 1 } }])
    prismaMock.certificateTemplate.findMany.mockResolvedValue([])

    const res = await pendingCertsRoute.GET(req(`/api/admin/org/${ORG}/certificates/pending`), ctx({ orgId: ORG }))
    const json = await res.json()

    expect(json.data[0].toGenerate).toEqual({ checkedIn: 6, all: 9 })
    expect(prismaMock.registration.groupBy.mock.calls[1][0].where.user).toEqual({ certificates: { none: { eventId: "ev_1" } } })
  })
})

describe("public announcements (item 11)", () => {
  it("lists published announcements only, pinned first", async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: "ev_1", status: "PUBLISHED", visibility: "PUBLIC", organizationId: ORG, enterpriseId: null })
    prismaMock.announcement.findMany.mockResolvedValue([{ id: "a1", title: "Gate 2", content: "Use gate 2", priority: "HIGH", isPinned: true, publishedAt: new Date("2026-11-01T00:00:00Z") }])

    const res = await announcementsRoute.GET(req("/api/events/tech-fest/announcements"), ctx({ slug: "tech-fest" }))
    const json = await res.json()

    expect(json.data).toHaveLength(1)
    const args = prismaMock.announcement.findMany.mock.calls[0][0]
    expect(args.where.publishedAt.not).toBeNull()
    expect(args.orderBy).toEqual([{ isPinned: "desc" }, { publishedAt: "desc" }])
  })

  it("hides a draft event and a private event's notices from outsiders", async () => {
    prismaMock.event.findFirst.mockResolvedValue({ id: "ev_1", status: "DRAFT", visibility: "PUBLIC", organizationId: ORG, enterpriseId: null })
    expect((await announcementsRoute.GET(req("/api/events/x/announcements"), ctx({ slug: "x" }))).status).toBe(404)

    prismaMock.event.findFirst.mockResolvedValue({ id: "ev_1", status: "PUBLISHED", visibility: "PRIVATE", organizationId: ORG, enterpriseId: null })
    authMock.mockResolvedValue(null)
    const json = await (await announcementsRoute.GET(req("/api/events/x/announcements"), ctx({ slug: "x" }))).json()
    expect(json.data).toEqual([])
    expect(prismaMock.announcement.findMany).not.toHaveBeenCalled()
  })
})

describe("event time zones (item 10)", () => {
  it("reads and writes datetime-local values on the event zone's clock", () => {
    const d = fromZonedInputValue("2027-01-10T18:30", "Asia/Kolkata")
    expect(d?.toISOString()).toBe("2027-01-10T13:00:00.000Z")
    expect(toZonedInputValue(d, "Asia/Kolkata")).toBe("2027-01-10T18:30")
    // across a DST change
    expect(fromZonedInputValue("2027-07-01T09:00", "Europe/London")?.toISOString()).toBe("2027-07-01T08:00:00.000Z")
    expect(toZonedInputValue("2027-07-01T08:00:00.000Z", "America/New_York")).toBe("2027-07-01T04:00")
    expect(fromZonedInputValue("not a date", "Asia/Kolkata")).toBeNull()
  })

  it("labels the zone only when it differs from the viewer's", () => {
    expect(zoneDiffersFromViewer("Asia/Kolkata", "2027-01-10T00:00:00Z", "Asia/Calcutta")).toBe(false)
    expect(zoneNote("Asia/Kolkata", "2027-01-10T00:00:00Z", "Asia/Kolkata")).toBeNull()
    expect(zoneNote("Asia/Kolkata", "2027-01-10T00:00:00Z", "Europe/London")).toContain("Asia/Kolkata")
  })
})

describe("public listing (items A and C)", () => {
  it("past events are a filter of their own, newest first", () => {
    const now = new Date("2026-11-09T00:00:00Z")
    const past = buildPublicEventsWhere(publicEventsQuerySchema.parse({ past: "1" }), now) as { AND: unknown[] }
    expect(past.AND).toContainEqual({ OR: [{ status: "COMPLETED" }, { endDate: { lt: now } }] })
    expect(publicEventsOrderBy({ past: true, upcoming: false })).toEqual({ startDate: "desc" })
    expect(publicEventsOrderBy({ past: false, upcoming: true })).toEqual({ startDate: "asc" })
  })

  it("cards show the real price", () => {
    expect(priceLabel(priceSummary([{ price: "0" }]), false)).toBe("Free")
    expect(priceLabel(priceSummary([{ price: "299.00" }]), true)).toBe("₹299")
    expect(priceLabel(priceSummary([{ price: "499" }, { price: "199" }]), true)).toBe("From ₹199")
    expect(priceLabel(priceSummary([{ price: 0 }, { price: 499 }]), true)).toBe("Free – ₹499")
    expect(priceLabel(null, true)).toBe("Paid")
  })
})

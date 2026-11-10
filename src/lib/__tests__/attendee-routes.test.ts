import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const prismaMock = vi.hoisted(() => ({
  registration: { findMany: vi.fn(), findUnique: vi.fn() },
  ticket: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
  event: { findUnique: vi.fn() },
  savedEvent: { upsert: vi.fn(), findMany: vi.fn() },
  notification: { deleteMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  certificate: { findUnique: vi.fn(), update: vi.fn() },
  certificateTemplate: { findFirst: vi.fn() },
  user: { upsert: vi.fn() },
  $transaction: vi.fn(),
}))
const authMock = vi.hoisted(() => vi.fn())
const authorizeMock = vi.hoisted(() => vi.fn())
const auditMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/authorization", () => ({ authorize: authorizeMock }))
vi.mock("@/lib/audit", () => ({ createAuditLog: auditMock, getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }) }))

import * as myRegistrationsRoute from "@/app/api/users/me/registrations/route"
import * as myTicketsRoute from "@/app/api/users/me/tickets/route"
import * as transferRoute from "@/app/api/tickets/[ticketId]/transfer/route"
import * as downloadRoute from "@/app/api/tickets/[ticketId]/download/route"
import * as guestPdfRoute from "@/app/api/events/[slug]/tickets/[ticketId]/pdf/route"
import * as savedEventsRoute from "@/app/api/users/me/saved-events/route"
import * as notificationRoute from "@/app/api/notifications/[notificationId]/route"
import * as certificateDownloadRoute from "@/app/api/certificates/[certificateId]/download/route"
import { verifyQRSignature } from "@/lib/registration-ticket"
import { newTicketViewToken, withTicketViewToken } from "@/lib/ticket-view-token"
import { eventTimeframe } from "@/lib/event-timeframe"
import { ticketPlace } from "@/lib/ticket-place"
import { buildTicketPdf, winAnsiBytes, wrapText } from "@/lib/ticket-pdf"
import { certificateDesignFromTemplate, fillCertificateTags } from "@/lib/certificate-pdf"

const ME = "user_me"
const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
const ctx = <T,>(params: T) => ({ params: Promise.resolve(params) })
const future = (h: number) => new Date(Date.now() + h * 3600_000)

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("TICKET_SECRET", "s".repeat(48))
  authMock.mockResolvedValue({ user: { id: ME, email: "me@example.com", name: "Me" } })
})

const event = { id: "ev_1", title: "Demo Day", slug: "demo-day", startDate: future(48), endDate: future(50), venue: "Hall A", venueCity: "Pune", isOnline: false, category: null, organization: { name: "Club" } }
const reg = (o: Record<string, unknown>) => ({
  id: "reg_x", registrationNumber: "EVT-1", status: "CONFIRMED", metadata: null, waitlistPosition: null,
  createdAt: new Date(), event, ticketType: { name: "General" }, ticket: null, payment: null, ...o,
})

describe("GET /api/users/me/registrations", () => {
  it("lists every registration of the signed-in user, with or without a ticket", async () => {
    prismaMock.registration.findMany.mockResolvedValue([
      reg({ id: "r_held", status: "PENDING", metadata: { holdExpiresAt: future(0.2).toISOString() }, payment: { status: "PENDING", amount: 499, currency: "INR" } }),
      reg({ id: "r_approval", status: "PENDING" }),
      reg({ id: "r_wait", status: "WAITLISTED", waitlistPosition: 3 }),
      reg({ id: "r_rejected", status: "REJECTED" }),
      reg({ id: "r_ok", ticket: { id: "t1", status: "ACTIVE", ticketNumber: "TKT-AAAA2222" } }),
    ])

    const res = await myRegistrationsRoute.GET()
    const json = await res.json()

    expect(prismaMock.registration.findMany.mock.calls[0][0].where).toMatchObject({ userId: ME })
    const byId = Object.fromEntries(json.data.map((r: { id: string; displayStatus: string }) => [r.id, r]))
    expect(byId.r_held.displayStatus).toBe("PENDING_PAYMENT")
    expect(byId.r_held.holdExpiresAt).toBeTruthy()
    expect(byId.r_held.payment).toEqual({ status: "PENDING", amount: 499, currency: "INR" })
    expect(byId.r_approval.displayStatus).toBe("PENDING_APPROVAL")
    expect(byId.r_wait.displayStatus).toBe("WAITLISTED")
    expect(byId.r_rejected.displayStatus).toBe("REJECTED")
    expect(byId.r_ok.ticket.ticketNumber).toBe("TKT-AAAA2222")
  })

  it("needs a session", async () => {
    authMock.mockResolvedValue(null)
    expect((await myRegistrationsRoute.GET()).status).toBe(401)
  })
})

describe("GET /api/users/me/tickets", () => {
  it("returns every ticket when no filter is given and rejects an unknown status", async () => {
    prismaMock.ticket.findMany.mockResolvedValue([])
    expect((await myTicketsRoute.GET(req("/api/users/me/tickets"))).status).toBe(200)
    expect(prismaMock.ticket.findMany.mock.calls[0][0].where).toEqual({ userId: ME })
    expect((await myTicketsRoute.GET(req("/api/users/me/tickets?status=bogus"))).status).toBe(400)
  })
})

describe("POST /api/tickets/[ticketId]/transfer", () => {
  const ticket = {
    id: "tkt_1", status: "ACTIVE", eventId: "ev_1", registrationId: "reg_1", ticketNumber: "TKT-OLD22222", metadata: null,
    registration: { status: "CONFIRMED", registrationNumber: "EVT-2026-00001" },
    event: { title: "Demo Day", endDate: future(5), organizationId: "org_1" },
    user: { email: "me@example.com", name: "Me" },
  }
  function txMock() {
    return {
      user: { upsert: vi.fn().mockResolvedValue({ id: "user_friend", name: "friend" }) },
      registration: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
      ticket: { findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      notification: { create: vi.fn() },
    }
  }

  it("validates the email before reading or creating anything", async () => {
    const res = await transferRoute.POST(req("/x", "POST", { recipientEmail: "not-an-email" }), ctx({ ticketId: "tkt_1" }))
    expect(res.status).toBe(400)
    expect(prismaMock.ticket.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("moves the ticket and registration in one transaction, with a new signed QR, and tells both people", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(ticket)
    const tx = txMock()
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))

    const res = await transferRoute.POST(req("/x", "POST", { recipientEmail: " Friend@Example.com " }), ctx({ ticketId: "tkt_1" }))

    expect(res.status).toBe(200)
    expect(tx.user.upsert.mock.calls[0][0].where).toEqual({ email: "friend@example.com" })
    const update = tx.ticket.updateMany.mock.calls[0][0]
    expect(update.where).toEqual({ id: "tkt_1", userId: ME, status: "ACTIVE" })
    expect(update.data.userId).toBe("user_friend")
    expect(update.data.ticketNumber).not.toBe("TKT-OLD22222")
    const qr = JSON.parse(update.data.qrCode)
    expect(qr.t).toBe(update.data.ticketNumber)
    expect(verifyQRSignature(qr.t, qr.e, qr.r, qr.s)).toBe(true)
    expect(tx.registration.update).toHaveBeenCalledWith({ where: { id: "reg_1" }, data: { userId: "user_friend" } })
    expect(tx.notification.create.mock.calls.map((c) => c[0].data.userId).sort()).toEqual([ME, "user_friend"].sort())
  })

  it("refuses a recipient already registered for the event (nothing moves)", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(ticket)
    const tx = txMock()
    tx.registration.findUnique.mockResolvedValue({ id: "reg_theirs" })
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))

    const res = await transferRoute.POST(req("/x", "POST", { recipientEmail: "friend@example.com" }), ctx({ ticketId: "tkt_1" }))

    expect(res.status).toBe(409)
    expect(tx.ticket.updateMany).not.toHaveBeenCalled()
  })

  it("refuses transferring to yourself before creating anyone", async () => {
    prismaMock.ticket.findFirst.mockResolvedValue(ticket)
    const res = await transferRoute.POST(req("/x", "POST", { recipientEmail: "ME@example.com" }), ctx({ ticketId: "tkt_1" }))
    expect(res.status).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe("ticket PDFs", () => {
  const pdfTicket = (o: Record<string, unknown> = {}) => ({
    id: "tkt_1", userId: ME, ticketNumber: "TKT-AAAA2222", qrCode: '{"v":1,"t":"TKT-AAAA2222"}', status: "ACTIVE", metadata: null,
    event: { slug: "demo-day", title: "Demo (Day) \\ ₹ — Ünïcode 日本", startDate: future(24), endDate: future(26), timezone: "Asia/Kolkata", venue: "Hall A", venueCity: "Pune", isOnline: true, type: "HYBRID", organization: { name: "Club" } },
    ticketType: { name: "In person", price: 499, currency: "INR" },
    registration: { registrationNumber: "EVT-2026-00001" },
    user: { name: "Me" },
    ...o,
  })

  it("gives the holder a real PDF", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(pdfTicket())
    const res = await downloadRoute.GET(req("/x"), ctx({ ticketId: "tkt_1" }))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4")
    expect(body.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true)
  })

  it("refuses someone else's ticket and a cancelled one", async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(pdfTicket({ userId: "someone_else" }))
    expect((await downloadRoute.GET(req("/x"), ctx({ ticketId: "tkt_1" }))).status).toBe(404)
    prismaMock.ticket.findUnique.mockResolvedValue(pdfTicket({ status: "CANCELLED" }))
    expect((await downloadRoute.GET(req("/x"), ctx({ ticketId: "tkt_1" }))).status).toBe(410)
  })

  it("lets a guest download with their link token, and nothing else", async () => {
    const { token, hash } = newTicketViewToken()
    prismaMock.ticket.findUnique.mockResolvedValue(pdfTicket({ metadata: withTicketViewToken(null, hash) }))
    authMock.mockResolvedValue(null)

    const ok = await guestPdfRoute.GET(req(`/api/events/demo-day/tickets/tkt_1/pdf?k=${token}`), ctx({ slug: "demo-day", ticketId: "tkt_1" }))
    expect(ok.status).toBe(200)
    expect(ok.headers.get("content-type")).toBe("application/pdf")

    const wrongToken = await guestPdfRoute.GET(req(`/api/events/demo-day/tickets/tkt_1/pdf?k=${newTicketViewToken().token}`), ctx({ slug: "demo-day", ticketId: "tkt_1" }))
    expect(wrongToken.status).toBe(404)
    const wrongEvent = await guestPdfRoute.GET(req(`/api/events/other/tickets/tkt_1/pdf?k=${token}`), ctx({ slug: "other", ticketId: "tkt_1" }))
    expect(wrongEvent.status).toBe(404)
  })

  it("writes a well-formed file: xref offsets point at their objects; text is WinAnsi", () => {
    const pdf = buildTicketPdf({
      eventTitle: "Talk (part 1)", when: "Mon", place: "Hall A", participant: "Me", ticketType: "General",
      price: "Free", ticketNumber: "TKT-AAAA2222", registrationNumber: "EVT-1", status: "Valid", qrPayload: "x",
    }).toString("latin1")
    const xrefAt = Number(pdf.match(/startxref\n(\d+)/)![1])
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe("xref")
    const offsets = [...pdf.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))
    offsets.forEach((o, i) => expect(pdf.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`))
    expect(winAnsiBytes("₹5 — é")).toEqual([...Buffer.from("Rs. 5 ", "latin1"), 0x97, 0x20, 0xe9])
    expect(wrapText("a ".repeat(200), 12, 100, 2)).toHaveLength(2)
  })
})

describe("POST /api/users/me/saved-events", () => {
  it("saves a public event and refuses a draft or private one as not found", async () => {
    prismaMock.event.findUnique.mockResolvedValueOnce({ id: "ev_1", status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null })
    expect((await savedEventsRoute.POST(req("/x", "POST", { eventId: "ev_1" }))).status).toBe(200)

    prismaMock.event.findUnique.mockResolvedValueOnce({ id: "ev_2", status: "DRAFT", visibility: "PUBLIC", deletedAt: null })
    expect((await savedEventsRoute.POST(req("/x", "POST", { eventId: "ev_2" }))).status).toBe(404)
    prismaMock.event.findUnique.mockResolvedValueOnce({ id: "ev_3", status: "PUBLISHED", visibility: "PRIVATE", deletedAt: null })
    expect((await savedEventsRoute.POST(req("/x", "POST", { eventId: "ev_3" }))).status).toBe(404)
    expect(prismaMock.savedEvent.upsert).toHaveBeenCalledTimes(1)
  })
})

describe("DELETE /api/notifications/[notificationId]", () => {
  it("is scoped to the signed-in user: another user's notification is 404", async () => {
    prismaMock.notification.deleteMany.mockResolvedValue({ count: 0 })
    const res = await notificationRoute.DELETE(req("/x", "DELETE"), ctx({ notificationId: "n_other" }))
    expect(res.status).toBe(404)
    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({ where: { id: "n_other", userId: ME } })

    prismaMock.notification.deleteMany.mockResolvedValue({ count: 1 })
    expect((await notificationRoute.DELETE(req("/x", "DELETE"), ctx({ notificationId: "n_mine" }))).status).toBe(200)
  })
})

describe("GET /api/certificates/[certificateId]/download", () => {
  const design = JSON.stringify({
    type: "Participation", orientation: "portrait", titleText: "Certificate of Excellence",
    bodyText: "<b>{{name}}</b> excelled at {{event_title}} ({{certificate_id}})", fontFamily: "serif",
    colors: { primary: "#112233", accent: "javascript:alert(1)" },
  })
  const cert = (o: Record<string, unknown> = {}) => ({
    id: "c1", userId: ME, eventId: "ev_1", certificateNumber: "CERT-ABC123", verificationCode: "VER-XYZ", type: "PARTICIPATION",
    title: "Certificate of Participation", recipientName: "Asha <script>", issuedDate: new Date("2026-11-01"), status: "GENERATED",
    metadata: null, downloadedAt: null,
    event: { title: "Demo Day", startDate: new Date("2026-10-30"), organizationId: "org_1", organization: { name: "Club" } },
    user: { id: ME, name: "Asha" },
    template: { templateHtml: design },
    ...o,
  })
  const html = async () => (await certificateDownloadRoute.GET(req("/x?format=html"), ctx({ certificateId: "c1" }))).text()
  const download = () => certificateDownloadRoute.GET(req("/x"), ctx({ certificateId: "c1" }))
  const pdfText = async (res: Response) => Buffer.from(await res.arrayBuffer()).toString("latin1")

  it("downloads a PDF attachment in the template's design, and tracks the recipient's download", async () => {
    prismaMock.certificate.findUnique.mockResolvedValue(cert())
    const res = await download()
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="certificate-CERT-ABC123.pdf"')
    const pdf = await pdfText(res)
    expect(pdf.startsWith("%PDF-1.4")).toBe(true)
    expect(pdf).toContain("/MediaBox [0 0 595.28 841.89]") // portrait template
    expect(pdf).toContain("/BaseFont /Times-Bold") // serif
    expect(pdf).toContain("(Certificate of Excellence)")
    // tags filled with the raw (not HTML-escaped) values
    expect(pdf).toContain("<b>Asha <script></b> excelled at Demo Day \\(CERT-ABC123\\)")
    expect(pdf).not.toContain("&lt;")
    expect(prismaMock.certificate.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "DOWNLOADED" }) }))
  })

  it("keeps the permission checks: signed out 401, a stranger 403, revoked 410 for the recipient, staff may download", async () => {
    authMock.mockResolvedValueOnce(null)
    expect((await download()).status).toBe(401)

    prismaMock.certificate.findUnique.mockResolvedValue(null)
    expect((await download()).status).toBe(404)

    prismaMock.certificate.findUnique.mockResolvedValue(cert({ userId: "someone_else" }))
    authorizeMock.mockResolvedValue({ authorized: false })
    expect((await download()).status).toBe(403)
    expect(authorizeMock).toHaveBeenCalledWith(ME, expect.any(String), { organizationId: "org_1" })

    prismaMock.certificate.findUnique.mockResolvedValue(cert({ metadata: { revokedAt: "2026-11-02T00:00:00Z" } }))
    const revoked = await download()
    expect(revoked.status).toBe(410)
    expect(revoked.headers.get("content-type")).toContain("json")

    prismaMock.certificate.findUnique.mockResolvedValue(cert({ userId: "someone_else", metadata: { revokedAt: "2026-11-02T00:00:00Z" } }))
    authorizeMock.mockResolvedValue({ authorized: true })
    const staff = await download()
    expect(staff.status).toBe(200)
    expect(staff.headers.get("content-type")).toBe("application/pdf")
    expect(prismaMock.certificate.update).not.toHaveBeenCalled()
  })

  it("built-in layout: landscape, award wording", async () => {
    prismaMock.certificate.findUnique.mockResolvedValue(cert({ template: null, type: "WINNER", title: "Winner Certificate" }))
    prismaMock.certificateTemplate.findFirst.mockResolvedValue(null)
    const pdf = await pdfText(await download())
    expect(pdf).toContain("/MediaBox [0 0 841.89 595.28]")
    expect(pdf).toContain("(Winner Certificate)")
    expect(pdf).toContain("(has won at)")
  })

  it("renders with the certificate's own template (title, body, orientation, safe colours)", async () => {
    prismaMock.certificate.findUnique.mockResolvedValue(cert())
    const page = await html()
    expect(page).toContain("Certificate of Excellence")
    expect(page).toContain("&lt;b&gt;Asha &lt;script&gt;&lt;/b&gt; excelled at Demo Day (CERT-ABC123)")
    expect(page).toContain("A4 portrait")
    expect(page).toContain("#112233")
    expect(page).not.toContain("javascript:")
    expect(prismaMock.certificateTemplate.findFirst).not.toHaveBeenCalled()
  })

  it("keeps an award's own title over the template's", async () => {
    prismaMock.certificate.findUnique.mockResolvedValue(cert({ type: "WINNER", title: "Winner Certificate" }))
    const page = await html()
    expect(page).toContain("Winner Certificate")
    expect(page).not.toContain("Certificate of Excellence")
  })

  it("falls back to the organization's default template, then to the built-in layout", async () => {
    prismaMock.certificate.findUnique.mockResolvedValue(cert({ template: null }))
    prismaMock.certificateTemplate.findFirst.mockResolvedValueOnce({ templateHtml: design })
    expect(await html()).toContain("Certificate of Excellence")
    expect(prismaMock.certificateTemplate.findFirst.mock.calls[0][0].where).toEqual({ organizationId: "org_1", isDefault: true })

    prismaMock.certificateTemplate.findFirst.mockResolvedValueOnce(null)
    const builtIn = await html()
    expect(builtIn).toContain("Certificate of Participation")
    expect(builtIn).toContain("A4 landscape")
  })

  it("ignores a template that isn't the builder's JSON", () => {
    expect(certificateDesignFromTemplate("<h1>raw html</h1>")).toBeNull()
    expect(fillCertificateTags("{{unknown}} & {{name}}", { name: "A" })).toBe("{{unknown}} &amp; A")
  })
})

describe("helpers", () => {
  it("eventTimeframe: upcoming, live while running, past after the end", () => {
    const now = new Date("2026-11-09T12:00:00Z")
    expect(eventTimeframe({ startDate: "2026-11-10T00:00:00Z", endDate: "2026-11-10T05:00:00Z" }, now)).toBe("upcoming")
    expect(eventTimeframe({ startDate: "2026-11-09T10:00:00Z", endDate: "2026-11-09T18:00:00Z" }, now)).toBe("live")
    expect(eventTimeframe({ startDate: "2026-11-08T10:00:00Z", endDate: "2026-11-08T18:00:00Z" }, now)).toBe("past")
  })

  it("ticketPlace: an in-person ticket of a hybrid event shows the venue", () => {
    const hybrid = { isOnline: true, type: "HYBRID", venue: "Auditorium", venueCity: "Pune" }
    expect(ticketPlace(hybrid, "In person")).toEqual({ kind: "venue", label: "Auditorium, Pune" })
    expect(ticketPlace(hybrid, "Online pass")).toEqual({ kind: "online", label: "Online" })
    expect(ticketPlace(hybrid, "General").label).toBe("Auditorium, Pune or online")
    expect(ticketPlace({ isOnline: true, type: "VIRTUAL" }, "In person").label).toBe("Online")
    expect(ticketPlace({ isOnline: false, venue: null }, "General").label).toBe("Venue to be announced")
  })
})

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { NextRequest } from "next/server"

// Concurrency tests against a real Postgres (the one in DATABASE_URL). They fire parallel
// requests at the route handlers and check that capacity counters can't be oversold and a
// voter can't stuff a poll. Opt-in, because CI has no database:
//   RUN_DB_TESTS=1 npx vitest run src/lib/__tests__/capacity-concurrency.db.test.ts
// Every record created here is removed in afterAll.
const RUN = process.env.RUN_DB_TESTS === "1"

const authMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  getClientInfo: () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }),
}))

import prisma from "@/lib/prisma"
import * as registrationsRoute from "@/app/api/registrations/route"
import * as voteRoute from "@/app/api/modules/live-poll/polls/[pollId]/vote/route"

const RUN_ID = `race${Date.now().toString(36)}`
const PARALLEL = 8
const createdEventIds: string[] = []
const createdPollIds: string[] = []

async function createEvent(name: string, opts: { maxCapacity?: number | null; waitlistEnabled?: boolean; ticketQuantity?: number | null }) {
  // The oldest user (seed data), never a user another test file is about to delete.
  const creator = await prisma.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } })
  const event = await prisma.event.create({
    data: {
      title: `${RUN_ID} ${name}`,
      slug: `${RUN_ID}-${name}`,
      description: "Concurrency test event (auto-deleted)",
      startDate: new Date(Date.now() + 7 * 86400000),
      endDate: new Date(Date.now() + 8 * 86400000),
      status: "PUBLISHED",
      maxCapacity: opts.maxCapacity ?? null,
      waitlistEnabled: opts.waitlistEnabled ?? false,
      createdById: creator.id,
    },
  })
  createdEventIds.push(event.id)
  const ticketType = await prisma.ticketType.create({
    data: { eventId: event.id, name: "General", price: 0, quantity: opts.ticketQuantity ?? null, maxPerUser: 5 },
  })
  return { eventId: event.id, ticketTypeId: ticketType.id }
}

// N guests register at once (guest checkout path: no session, unique guest emails).
async function registerInParallel(eventId: string, ticketTypeId: string, extra: Record<string, unknown> = {}) {
  authMock.mockResolvedValue(null)
  const responses = await Promise.all(
    Array.from({ length: PARALLEL }, (_, i) =>
      registrationsRoute.POST(
        new NextRequest("http://localhost/api/registrations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            eventId,
            ticketTypeId,
            quantity: 1,
            guestEmail: `${RUN_ID}-${eventId.slice(-6)}-${i}@race.test`,
            guestName: `Racer ${i}`,
            ...extra,
          }),
        })
      )
    )
  )
  return Promise.all(responses.map(async (r) => ({ status: r.status, body: await r.json() })))
}

describe.runIf(RUN)("registration capacity under concurrency (bug 6)", () => {
  afterAll(async () => {
    if (createdEventIds.length) {
      const where = { eventId: { in: createdEventIds } }
      await prisma.ticket.deleteMany({ where })
      await prisma.payment.deleteMany({ where })
      await prisma.registration.deleteMany({ where })
      await prisma.coupon.deleteMany({ where })
      await prisma.ticketType.deleteMany({ where })
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
    }
    await prisma.user.deleteMany({ where: { email: { startsWith: `${RUN_ID}-` } } })
  })

  it("never confirms more registrations than the event's capacity", async () => {
    const { eventId, ticketTypeId } = await createEvent("cap1", { maxCapacity: 1 })

    const results = await registerInParallel(eventId, ticketTypeId)

    const ok = results.filter((r) => r.status === 201)
    expect(ok).toHaveLength(1)
    expect(results.filter((r) => r.body.message === "Event is full")).toHaveLength(PARALLEL - 1)
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    expect(event.currentRegistrations).toBe(1)
    expect(await prisma.registration.count({ where: { eventId } })).toBe(1)
  })

  it("never sells more tickets than the ticket type's quantity", async () => {
    const { eventId, ticketTypeId } = await createEvent("tix3", { ticketQuantity: 3 })

    const results = await registerInParallel(eventId, ticketTypeId)

    expect(results.filter((r) => r.status === 201)).toHaveLength(3)
    expect(results.filter((r) => r.body.message === "Not enough tickets available")).toHaveLength(PARALLEL - 3)
    const tt = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } })
    expect(tt.sold).toBe(3)
  })

  it("waitlists the overflow with unique, gap-free positions", async () => {
    const { eventId, ticketTypeId } = await createEvent("wait2", { maxCapacity: 2, waitlistEnabled: true })

    const results = await registerInParallel(eventId, ticketTypeId)

    const regs = await prisma.registration.findMany({ where: { eventId }, select: { status: true, waitlistPosition: true } })
    expect(results.every((r) => r.status === 201)).toBe(true)
    expect(regs.filter((r) => r.status === "CONFIRMED")).toHaveLength(2)
    const positions = regs.filter((r) => r.status === "WAITLISTED").map((r) => r.waitlistPosition).sort((a, b) => a! - b!)
    expect(positions).toEqual(Array.from({ length: PARALLEL - 2 }, (_, i) => i + 1))
  })

  it("never redeems a coupon more times than maxUses", async () => {
    const { eventId, ticketTypeId } = await createEvent("coupon2", {})
    await prisma.coupon.create({
      data: {
        code: `${RUN_ID}-C2`.toUpperCase(),
        eventId,
        discountType: "PERCENTAGE",
        discountValue: 10,
        maxUses: 2,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000),
      },
    })

    const results = await registerInParallel(eventId, ticketTypeId, { couponCode: `${RUN_ID}-C2`.toUpperCase() })

    expect(results.filter((r) => r.status === 201)).toHaveLength(2)
    const coupon = await prisma.coupon.findFirstOrThrow({ where: { eventId } })
    expect(coupon.currentUses).toBe(2)
  })
})

describe.runIf(RUN)("live poll ballots under concurrency (bug 8)", () => {
  let pollId = ""

  beforeAll(async () => {
    // organizationId null: no site config needed, voting still requires a signed-in user.
    const poll = await prisma.featureModuleData.create({
      data: {
        moduleId: "live-poll",
        dataType: "poll_definition",
        title: `${RUN_ID} poll`,
        data: { question: "Concurrency?", options: [{ text: "A", votes: 0 }, { text: "B", votes: 0 }] },
      },
    })
    pollId = poll.id
    createdPollIds.push(poll.id)
  })

  afterAll(async () => {
    await prisma.featureModuleData.deleteMany({
      where: {
        OR: [
          { id: { in: createdPollIds } },
          { dataType: "poll_vote", uniqueKey: { startsWith: `live-poll:${pollId}:` } },
          { dataType: "poll_vote", data: { path: ["pollId"], equals: pollId } },
        ],
      },
    })
  })

  const vote = () =>
    voteRoute.POST(
      new NextRequest(`http://localhost/api/modules/live-poll/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionIndex: 0 }),
      }),
      { params: Promise.resolve({ pollId }) }
    )

  it("counts exactly one ballot when the same user votes many times at once", async () => {
    authMock.mockResolvedValue({ user: { id: `${RUN_ID}-same-voter`, name: "Same" } })

    const statuses = (await Promise.all(Array.from({ length: PARALLEL }, vote))).map((r) => r.status)

    expect(statuses.filter((s) => s === 200)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(PARALLEL - 1)
    expect(await prisma.featureModuleData.count({ where: { dataType: "poll_vote", uniqueKey: { startsWith: `live-poll:${pollId}:` } } })).toBe(1)
  })

  it("keeps every distinct voter's ballot in the tally (no lost updates)", async () => {
    let n = 0
    authMock.mockImplementation(async () => ({ user: { id: `${RUN_ID}-voter-${n++}`, name: "Voter" } }))

    const statuses = (await Promise.all(Array.from({ length: PARALLEL }, vote))).map((r) => r.status)

    expect(statuses.every((s) => s === 200)).toBe(true)
    const poll = await prisma.featureModuleData.findUniqueOrThrow({ where: { id: pollId } })
    const options = (poll.data as { options: { votes: number }[] }).options
    expect(options[0].votes).toBe(PARALLEL + 1) // + the single ballot from the previous test
    expect(poll.participantCount).toBe(PARALLEL + 1)
  })
})

import { describe, it, expect, vi } from "vitest"

// /dashboard/events cancels through /api/registrations/[registrationId]/cancel, which
// needs the registration's id; a ticket's own id is a different record.
const prismaMock = vi.hoisted(() => ({ ticket: { findMany: vi.fn().mockResolvedValue([]) } }))
vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))

import { getUserTickets } from "@/lib/ticket"

describe("getUserTickets", () => {
  it("returns the registration id with each ticket", async () => {
    await getUserTickets("user_1", undefined, "all")

    const args = prismaMock.ticket.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ userId: "user_1" })
    expect(args.include.registration.select).toMatchObject({ id: true, registrationNumber: true, status: true })
  })
})

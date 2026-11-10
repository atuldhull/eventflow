import { describe, it, expect, vi } from "vitest"
import {
  DEFAULT_REGISTRATION_FIELDS,
  TicketQuantityError,
  eventColumns,
  eventUpdateSchema,
  imageUrlSchema,
  mergeEventSettings,
  registrationFieldsFromSettings,
  syncTicketTypes,
} from "@/lib/event-update"

describe("mergeEventSettings", () => {
  it("sets given keys, deletes null and empty ones, and keeps keys it was not given", () => {
    const current = { budgetAmount: 500, addons: [{ name: "Lunch" }], somethingElse: "kept" }
    const next = mergeEventSettings(current, {
      budgetAmount: null,
      allowedEmailDomains: "",
      registrationFields: { phone: false, organization: true, department: false },
    })
    expect(next).toEqual({
      addons: [{ name: "Lunch" }],
      somethingElse: "kept",
      registrationFields: { phone: false, organization: true, department: false },
    })
  })

  it("starts from an empty object when there are no settings yet", () => {
    expect(mergeEventSettings(null, { budgetAmount: 10 })).toEqual({ budgetAmount: 10 })
    expect(mergeEventSettings([1, 2], undefined)).toEqual({})
  })
})

describe("registrationFieldsFromSettings", () => {
  it("defaults to the old form (phone asked, the others not) when nothing is saved", () => {
    expect(registrationFieldsFromSettings(null)).toEqual(DEFAULT_REGISTRATION_FIELDS)
    expect(registrationFieldsFromSettings({ registrationFields: "junk" })).toEqual(DEFAULT_REGISTRATION_FIELDS)
  })

  it("reads what the wizard saved", () => {
    expect(registrationFieldsFromSettings({ registrationFields: { phone: false, organization: true, department: true } }))
      .toEqual({ phone: false, organization: true, department: true })
  })
})

describe("eventUpdateSchema", () => {
  it("drops fields an edit must never set", () => {
    const parsed = eventUpdateSchema.parse({
      title: "A proper title",
      organizationId: "org_other",
      currentRegistrations: 9999,
      createdById: "someone",
      deletedAt: null,
    })
    expect(parsed).toEqual({ title: "A proper title" })
    expect(eventColumns(parsed)).toEqual({ title: "A proper title" })
  })

  it("turns cleared text into null and keeps nested lists out of the columns", () => {
    const parsed = eventUpdateSchema.parse({ venue: "", rules: null, faqs: [], settings: { budgetAmount: null } })
    expect(eventColumns(parsed)).toEqual({ venue: null, rules: null })
  })

  it("only accepts a draft or publish status", () => {
    expect(eventUpdateSchema.safeParse({ status: "CANCELLED" }).success).toBe(false)
    expect(eventUpdateSchema.safeParse({ status: "PUBLISHED" }).success).toBe(true)
  })

  it("rejects an online link that isn't http(s)", () => {
    expect(eventUpdateSchema.safeParse({ onlineLink: "javascript:alert(1)" }).success).toBe(false)
    expect(eventUpdateSchema.safeParse({ onlineLink: "https://meet.example.com/x" }).success).toBe(true)
  })
})

describe("imageUrlSchema", () => {
  it.each([
    ["", true],
    ["/uploads/0b8a3c1e-1111-2222-3333-444455556666.png", true],
    ["https://images.example.com/cover.jpg", true],
    ["/uploads/../../etc/passwd", false],
    ["/uploads/report.pdf", false],
    ["javascript:alert(1)", false],
    ["http://insecure.example.com/x.png", false],
  ])("%s -> %s", (value, ok) => {
    expect(imageUrlSchema.safeParse(value).success).toBe(ok)
  })
})

describe("syncTicketTypes", () => {
  function fakeTx(existing: { id: string; sold: number; registrations: number }[]) {
    return {
      ticketType: {
        findMany: vi.fn().mockResolvedValue(existing.map((t) => ({ id: t.id, sold: t.sold, _count: { registrations: t.registrations } }))),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
      },
    }
  }
  const tt = (over: Record<string, unknown>) => ({
    name: "General", price: 0, currency: "INR", quantity: null, maxPerUser: 1, isActive: true, isHidden: false, ...over,
  })

  it("updates kept types in place, creates new ones, deletes unused removed ones and switches off used ones", async () => {
    const tx = fakeTx([
      { id: "keep", sold: 3, registrations: 3 },
      { id: "unused", sold: 0, registrations: 0 },
      { id: "used", sold: 2, registrations: 2 },
    ])
    await syncTicketTypes(tx as never, "evt_1", [tt({ id: "keep", name: "General", quantity: 10 }), tt({ name: "VIP" })])

    expect(tx.ticketType.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: "evt_1" } }))
    expect(tx.ticketType.update).toHaveBeenCalledWith({ where: { id: "keep" }, data: expect.objectContaining({ name: "General", quantity: 10, sortOrder: 0 }) })
    expect(tx.ticketType.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: "VIP", eventId: "evt_1", sortOrder: 1 }) })
    expect(tx.ticketType.delete).toHaveBeenCalledWith({ where: { id: "unused" } })
    expect(tx.ticketType.update).toHaveBeenCalledWith({ where: { id: "used" }, data: { isActive: false } })
  })

  it("treats an id from another event as a new ticket type (never updates it)", async () => {
    const tx = fakeTx([{ id: "mine", sold: 0, registrations: 0 }])
    await syncTicketTypes(tx as never, "evt_1", [tt({ id: "someone_elses", name: "Sneaky" })])
    expect(tx.ticketType.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: "someone_elses" } }))
    expect(tx.ticketType.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: "Sneaky", eventId: "evt_1" }) })
  })

  it("refuses a quantity below what is already sold", async () => {
    const tx = fakeTx([{ id: "keep", sold: 9, registrations: 9 }])
    await expect(syncTicketTypes(tx as never, "evt_1", [tt({ id: "keep", quantity: 5 })])).rejects.toBeInstanceOf(TicketQuantityError)
    expect(tx.ticketType.update).not.toHaveBeenCalled()
  })
})

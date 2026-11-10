import { describe, it, expect, beforeEach } from "vitest"
import {
  OFFLINE_TICKETS_KEY,
  clearOfflineTickets,
  hasOfflineTickets,
  isNetworkError,
  loadOfflineTickets,
  pickOfflineTicket,
  saveOfflineTickets,
} from "@/lib/offline-tickets"

// In-memory stand-in for window.localStorage (tests run in the node environment)
class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, String(v)) }
  removeItem(k: string) { this.data.delete(k) }
}

// The shape /api/users/me/tickets returns, with fields the device copy must NOT keep
const apiTicket = (id: string, title = "AI in Production") => ({
  id,
  ticketNumber: `TKT-${id}`,
  qrCode: `qr-payload-${id}`,
  status: "ACTIVE",
  attendeeEmail: "someone@example.com",
  event: {
    title,
    slug: "ai-in-production-talk",
    startDate: "2026-12-04T10:30:00.000Z",
    endDate: "2026-12-04T12:00:00.000Z",
    venue: "Hall A",
    venueCity: "Pune",
    isOnline: false,
    type: "IN_PERSON",
    coverImage: "https://cdn.example.com/cover.png",
    organization: { name: "Tech Club", ownerEmail: "owner@example.com" },
  },
  ticketType: { name: "General", price: 0, currency: "INR" },
  registration: { id: "reg1", registrationNumber: "REG-1", status: "CONFIRMED", formResponses: { phone: "999" } },
  checkIns: [{ checkedInAt: "2026-12-04T10:40:00.000Z", scannedBy: "vol1" }],
  payment: { razorpayPaymentId: "pay_x" },
})

describe("offline tickets (device copy)", () => {
  let storage: MemoryStorage
  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it("saves and loads a user's tickets with the save time", () => {
    const at = new Date("2026-11-10T08:00:00.000Z")
    expect(saveOfflineTickets("user-a", [apiTicket("t1"), apiTicket("t2")], at, storage)).toBe(true)
    const snap = loadOfflineTickets("user-a", storage)
    expect(snap?.userId).toBe("user-a")
    expect(snap?.savedAt).toBe(at.toISOString())
    expect(snap?.tickets.map((t) => t.id)).toEqual(["t1", "t2"])
    expect(snap?.tickets[0].qrCode).toBe("qr-payload-t1")
    expect(snap?.tickets[0].event.title).toBe("AI in Production")
    expect(snap?.tickets[0].ticketType.name).toBe("General")
  })

  it("keeps only what the ticket and its QR need", () => {
    saveOfflineTickets("user-a", [apiTicket("t1")], new Date(), storage)
    const raw = storage.getItem(OFFLINE_TICKETS_KEY)!
    for (const leak of ["someone@example.com", "owner@example.com", "formResponses", "pay_x", "cover.png", "scannedBy"]) {
      expect(raw, leak).not.toContain(leak)
    }
    const t = loadOfflineTickets("user-a", storage)!.tickets[0]
    expect(t).toEqual({
      id: "t1",
      ticketNumber: "TKT-t1",
      qrCode: "qr-payload-t1",
      status: "ACTIVE",
      event: {
        title: "AI in Production",
        slug: "ai-in-production-talk",
        startDate: "2026-12-04T10:30:00.000Z",
        endDate: "2026-12-04T12:00:00.000Z",
        venue: "Hall A",
        venueCity: "Pune",
        isOnline: false,
        type: "IN_PERSON",
        organization: { name: "Tech Club" },
      },
      ticketType: { name: "General", price: 0, currency: "INR" },
      registration: { id: "reg1", registrationNumber: "REG-1", status: "CONFIRMED" },
      checkIns: [{ checkedInAt: "2026-12-04T10:40:00.000Z" }],
    })
  })

  it("never returns another user's tickets, and removes them", () => {
    saveOfflineTickets("user-a", [apiTicket("t1")], new Date(), storage)
    expect(loadOfflineTickets("user-b", storage)).toBeNull()
    // user A's copy is gone, not just hidden
    expect(storage.getItem(OFFLINE_TICKETS_KEY)).toBeNull()
    expect(loadOfflineTickets("user-a", storage)).toBeNull()
  })

  it("a new user's save replaces the previous user's copy (account switch)", () => {
    saveOfflineTickets("user-a", [apiTicket("a1")], new Date(), storage)
    saveOfflineTickets("user-b", [apiTicket("b1")], new Date(), storage)
    expect(loadOfflineTickets("user-a", storage)).toBeNull()
    saveOfflineTickets("user-b", [apiTicket("b1")], new Date(), storage)
    expect(loadOfflineTickets("user-b", storage)?.tickets.map((t) => t.id)).toEqual(["b1"])
    expect(storage.getItem(OFFLINE_TICKETS_KEY)).not.toContain("a1")
  })

  it("without a session (offline) returns the device's only copy", () => {
    saveOfflineTickets("user-a", [apiTicket("t1")], new Date(), storage)
    expect(loadOfflineTickets(null, storage)?.userId).toBe("user-a")
    expect(loadOfflineTickets(undefined, storage)?.tickets).toHaveLength(1)
  })

  it("clears on sign-out", () => {
    saveOfflineTickets("user-a", [apiTicket("t1")], new Date(), storage)
    expect(hasOfflineTickets(storage)).toBe(true)
    clearOfflineTickets(storage)
    expect(hasOfflineTickets(storage)).toBe(false)
    expect(loadOfflineTickets(null, storage)).toBeNull()
    expect(loadOfflineTickets("user-a", storage)).toBeNull()
  })

  it("drops corrupt or foreign-format storage instead of throwing", () => {
    for (const bad of ["{not json", "null", "42", '"text"', JSON.stringify({ userId: "", savedAt: "x", tickets: [] }), JSON.stringify({ userId: "u", tickets: "nope", savedAt: "x" }), JSON.stringify({ tickets: [] })]) {
      storage.setItem(OFFLINE_TICKETS_KEY, bad)
      expect(loadOfflineTickets("u", storage), bad).toBeNull()
      expect(storage.getItem(OFFLINE_TICKETS_KEY), bad).toBeNull()
    }
  })

  it("skips malformed ticket entries but keeps the good ones", () => {
    storage.setItem(OFFLINE_TICKETS_KEY, JSON.stringify({ userId: "u", savedAt: "2026-11-10T00:00:00.000Z", tickets: [null, 5, { id: "x" }, apiTicket("ok")] }))
    expect(loadOfflineTickets("u", storage)?.tickets.map((t) => t.id)).toEqual(["ok"])
    expect(pickOfflineTicket({ id: "t", qrCode: "q" })).toBeNull()
  })

  it("survives storage that throws (blocked or full)", () => {
    const broken = {
      getItem: () => { throw new Error("SecurityError") },
      setItem: () => { throw new Error("QuotaExceededError") },
      removeItem: () => { throw new Error("SecurityError") },
    }
    expect(saveOfflineTickets("u", [apiTicket("t1")], new Date(), broken)).toBe(false)
    expect(loadOfflineTickets("u", broken)).toBeNull()
    expect(hasOfflineTickets(broken)).toBe(false)
    expect(() => clearOfflineTickets(broken)).not.toThrow()
    // no storage at all (server render)
    expect(saveOfflineTickets("u", [], new Date(), null)).toBe(false)
    expect(loadOfflineTickets("u", null)).toBeNull()
  })

  it("does not save without a user id", () => {
    expect(saveOfflineTickets("", [apiTicket("t1")], new Date(), storage)).toBe(false)
    expect(hasOfflineTickets(storage)).toBe(false)
  })

  it("treats fetch's TypeError as a network failure", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true)
    expect(isNetworkError(new SyntaxError("Unexpected token <"))).toBe(false)
    expect(isNetworkError(new Error("x"))).toBe(false)
  })
})

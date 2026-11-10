// A copy of the signed-in attendee's tickets kept on this device, so the tickets page
// (and each QR code) still opens at a venue with no signal.
//
// Privacy rules:
// - Only the fields needed to show a ticket and its QR are kept (no email, phone,
//   form answers, payment data, cover images).
// - One owner per device: saving for a user replaces whatever was there, and a read for
//   a different user returns nothing and removes the other user's copy.
// - Cleared on sign-out (see clearOfflineTickets and OfflineDataGuard).

export const OFFLINE_TICKETS_KEY = "eventflow-offline-tickets:v1"

/** The SW cache name prefix (public/sw.js). Signed-in pages cached there are removed on sign-out too. */
const SW_CACHE_PREFIX = "eventflow-"

export interface OfflineTicket {
  id: string
  ticketNumber: string
  qrCode: string
  status: string
  event: {
    title: string
    slug: string
    startDate: string
    endDate: string
    venue?: string | null
    venueCity?: string | null
    isOnline: boolean
    type?: string | null
    organization?: { name: string } | null
  }
  ticketType: { name: string; price: number; currency: string }
  registration: { id: string; registrationNumber: string; status: string }
  checkIns?: { checkedInAt: string }[]
}

export interface OfflineTicketsSnapshot {
  userId: string
  /** ISO time the copy was taken (last successful online load) */
  savedAt: string
  tickets: OfflineTicket[]
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null
  } catch {
    // storage blocked (privacy mode, sandboxed frame)
    return null
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v))
const optStr = (v: unknown): string | null => (typeof v === "string" ? v : null)

/** Keep only what the ticket card and QR need. Returns null for anything that isn't a ticket. */
export function pickOfflineTicket(raw: unknown): OfflineTicket | null {
  if (!raw || typeof raw !== "object") return null
  const t = raw as Record<string, unknown>
  const event = (t.event ?? {}) as Record<string, unknown>
  const ticketType = (t.ticketType ?? {}) as Record<string, unknown>
  const registration = (t.registration ?? {}) as Record<string, unknown>
  if (typeof t.id !== "string" || typeof t.qrCode !== "string" || typeof event.title !== "string") return null
  const org = event.organization as Record<string, unknown> | null | undefined
  const checkIns = Array.isArray(t.checkIns)
    ? (t.checkIns as Record<string, unknown>[]).map((c) => ({ checkedInAt: str(c?.checkedInAt) }))
    : undefined
  return {
    id: t.id,
    ticketNumber: str(t.ticketNumber),
    qrCode: t.qrCode,
    status: str(t.status),
    event: {
      title: event.title,
      slug: str(event.slug),
      startDate: str(event.startDate),
      endDate: str(event.endDate),
      venue: optStr(event.venue),
      venueCity: optStr(event.venueCity),
      isOnline: !!event.isOnline,
      type: optStr(event.type),
      organization: org && typeof org.name === "string" ? { name: org.name } : null,
    },
    ticketType: {
      name: str(ticketType.name),
      price: typeof ticketType.price === "number" ? ticketType.price : Number(ticketType.price) || 0,
      currency: str(ticketType.currency),
    },
    registration: {
      id: str(registration.id),
      registrationNumber: str(registration.registrationNumber),
      status: str(registration.status),
    },
    ...(checkIns ? { checkIns } : {}),
  }
}

/** Save the user's tickets on this device, replacing any earlier copy (of any user). */
export function saveOfflineTickets(userId: string, tickets: unknown[], now: Date = new Date(), storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage || !userId) return false
  const snapshot: OfflineTicketsSnapshot = {
    userId,
    savedAt: now.toISOString(),
    tickets: tickets.map(pickOfflineTicket).filter((t): t is OfflineTicket => t !== null),
  }
  try {
    storage.setItem(OFFLINE_TICKETS_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    // quota exceeded or storage blocked: offline copy is best-effort
    return false
  }
}

function readSnapshot(storage: StorageLike): OfflineTicketsSnapshot | null {
  let raw: string | null
  try {
    raw = storage.getItem(OFFLINE_TICKETS_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<OfflineTicketsSnapshot> | null
    if (!parsed || typeof parsed.userId !== "string" || !parsed.userId || typeof parsed.savedAt !== "string" || !Array.isArray(parsed.tickets)) {
      throw new Error("bad snapshot")
    }
    return {
      userId: parsed.userId,
      savedAt: parsed.savedAt,
      tickets: parsed.tickets.map(pickOfflineTicket).filter((t): t is OfflineTicket => t !== null),
    }
  } catch {
    // corrupt or from an old format: drop it
    try { storage.removeItem(OFFLINE_TICKETS_KEY) } catch {}
    return null
  }
}

/**
 * The saved copy for this user. With no userId (offline, so the session can't be checked)
 * it returns the device's only copy: the last user who loaded tickets here and hasn't
 * signed out. A copy that belongs to someone else is removed and never returned.
 */
export function loadOfflineTickets(userId: string | null | undefined, storage: StorageLike | null = defaultStorage()): OfflineTicketsSnapshot | null {
  if (!storage) return null
  const snapshot = readSnapshot(storage)
  if (!snapshot) return null
  if (userId && snapshot.userId !== userId) {
    try { storage.removeItem(OFFLINE_TICKETS_KEY) } catch {}
    return null
  }
  return snapshot
}

export function hasOfflineTickets(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false
  try {
    return storage.getItem(OFFLINE_TICKETS_KEY) !== null
  } catch {
    return false
  }
}

/** Remove the device copy (sign-out). Never throws. */
export function clearOfflineTickets(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try { storage.removeItem(OFFLINE_TICKETS_KEY) } catch {}
}

/**
 * Sign-out cleanup: the device copy, plus the signed-in pages the service worker cached
 * (they were rendered for the user who is leaving). Static assets stay cached.
 */
export async function forgetOfflineData(): Promise<void> {
  clearOfflineTickets()
  try {
    if (typeof caches === "undefined") return
    for (const name of await caches.keys()) {
      if (!name.startsWith(SW_CACHE_PREFIX)) continue
      const cache = await caches.open(name)
      for (const req of await cache.keys()) {
        const path = new URL(req.url).pathname
        if (path.startsWith("/dashboard") || path.startsWith("/api/")) await cache.delete(req)
      }
    }
  } catch {
    // Cache Storage unavailable (insecure origin): nothing cached to remove
  }
}

/** True when a fetch failed because the network (or the SW, offline) couldn't reach the server. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError
}

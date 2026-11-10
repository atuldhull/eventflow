import crypto from "crypto"
import type { Prisma } from "@prisma/client"

/**
 * A guest (registered without signing in) can't open /dashboard/tickets, so they get a
 * view-only link to their ticket: /events/<slug>/ticket/<ticketId>?k=<token>. The token is
 * 32 random bytes; only its SHA-256 is stored, in ticket.metadata.viewTokenHash. Removing
 * the hash (on transfer, or when a cancelled ticket is re-issued) revokes the link, and a
 * cancelled ticket shows no QR anyway.
 */
const KEY = "viewTokenHash"

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex")

function asObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Prisma.JsonObject) : {}
}

export function newTicketViewToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("base64url")
  return { token, hash: hashToken(token) }
}

export function ticketViewTokenMatches(metadata: Prisma.JsonValue | null | undefined, token: string | null | undefined): boolean {
  if (typeof token !== "string" || token.length < 20 || token.length > 128) return false
  const stored = asObject(metadata)[KEY]
  if (typeof stored !== "string" || !/^[0-9a-f]{64}$/.test(stored)) return false
  return crypto.timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(hashToken(token), "hex"))
}

export function withTicketViewToken(metadata: Prisma.JsonValue | null | undefined, hash: string): Prisma.JsonObject {
  return { ...asObject(metadata), [KEY]: hash }
}

export function withoutTicketViewToken(metadata: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  const copy = { ...asObject(metadata) }
  delete copy[KEY]
  return copy
}

export function ticketViewPath(eventSlug: string, ticketId: string, token: string): string {
  return `/events/${encodeURIComponent(eventSlug)}/ticket/${encodeURIComponent(ticketId)}?k=${encodeURIComponent(token)}`
}

/** Creates (or replaces) the ticket's view link and returns its path (the token is not kept). */
export async function issueTicketViewLink(
  db: Pick<Prisma.TransactionClient, "ticket">,
  ticket: { id: string; metadata: Prisma.JsonValue | null },
  eventSlug: string
): Promise<string> {
  const { token, hash } = newTicketViewToken()
  await db.ticket.update({ where: { id: ticket.id }, data: { metadata: withTicketViewToken(ticket.metadata, hash) } })
  return ticketViewPath(eventSlug, ticket.id, token)
}

/** Strips the stored hash from a ticket before it is sent to a browser. */
export function publicTicket<T extends { metadata?: Prisma.JsonValue | null }>(ticket: T): Omit<T, "metadata"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { metadata, ...rest } = ticket
  return rest
}

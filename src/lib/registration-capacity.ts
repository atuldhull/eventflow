import type { Prisma } from "@prisma/client"

// Capacity bookkeeping shared by every route that creates, confirms, cancels or refunds
// a registration. All claims are conditional UPDATE ... WHERE <still room> statements:
// Postgres re-checks the WHERE against the latest committed row while holding the row
// lock, so concurrent requests can't both take the last seat. Call these inside a
// transaction so a later failure rolls the claims back.
//
// Counting model:
// - event.currentRegistrations counts CONFIRMED and WAITLISTED registrations (and the
//   CHECKED_IN / NO_SHOW states a confirmed one moves to), plus PENDING registrations
//   that hold a seat while their payment is in progress (see seat-hold.ts).
// - Free registrations that await organizer approval are PENDING without a hold and
//   only count once approved.
// - ticketType.sold is claimed for every registration at creation (by
//   metadata.ticketQuantity) and the coupon use with it. Both are given back exactly once
//   when the registration is cancelled, rejected, refunded or its payment hold released;
//   metadata.stockReleasedAt / couponReleasedAt record that, and are cleared when a
//   later step claims them again.

type Tx = Prisma.TransactionClient

// Paid registrations hold their seat for this long while the buyer completes payment.
export const SEAT_HOLD_MINUTES = 15
export const SEAT_HOLD_MS = SEAT_HOLD_MINUTES * 60 * 1000

export type HoldReleaseReason = "expired" | "payment_failed" | "cancelled" | "rejected"

// A hold released for one of these reasons may be re-claimed if the payment still goes
// through later: the buyer clearly wanted the seat. Holds cancelled or rejected on
// purpose stay that way (the payment is then flagged for a refund).
const RECLAIMABLE_RELEASE_REASONS: readonly string[] = ["expired", "payment_failed"]

const COUNTED_STATUSES: readonly string[] = ["CONFIRMED", "WAITLISTED", "CHECKED_IN", "NO_SHOW"]

type RegistrationState = { status: string; metadata: Prisma.JsonValue | null }

export function registrationMeta(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Prisma.JsonObject) : {}
}

export function withoutKeys(meta: Prisma.JsonObject, keys: readonly string[]): Prisma.JsonObject {
  const copy: Prisma.JsonObject = { ...meta }
  for (const key of keys) delete copy[key]
  return copy
}

export const HOLD_KEYS = ["holdExpiresAt", "holdReleasedAt", "holdReleasedReason"] as const

// Number of tickets the registration claimed from its ticket type (stored at creation).
export function ticketQuantity(meta: Prisma.JsonObject): number {
  const q = Number(meta.ticketQuantity)
  return Number.isInteger(q) && q > 0 ? q : 1
}

export function hasActiveHold(reg: RegistrationState): boolean {
  const meta = registrationMeta(reg.metadata)
  return reg.status === "PENDING" && typeof meta.holdExpiresAt === "string" && !meta.holdReleasedAt
}

export function holdExpiresAt(reg: RegistrationState): Date | null {
  if (!hasActiveHold(reg)) return null
  const at = new Date(String(registrationMeta(reg.metadata).holdExpiresAt))
  return Number.isNaN(at.getTime()) ? null : at
}

// --- Ticket stock and coupon use bookkeeping ------------------------------------------

export const STOCK_RELEASED = "stockReleasedAt"
export const COUPON_RELEASED = "couponReleasedAt"
// Every flag that a fresh claim of seat, stock and coupon use clears.
export const RELEASE_KEYS = [...HOLD_KEYS, STOCK_RELEASED, COUPON_RELEASED] as const

export function stockIsClaimed(meta: Prisma.JsonObject): boolean {
  return !meta[STOCK_RELEASED]
}

export function couponIsClaimed(meta: Prisma.JsonObject): boolean {
  return !meta[COUPON_RELEASED]
}

// Gives back the registration's ticket stock and (if it has one) coupon use unless that
// already happened, and returns the metadata recording it. Callers persist the metadata
// in the same guarded status update, so a second cancel/refund finds the flags and skips.
export async function releaseStockAndCoupon(
  tx: Tx,
  reg: { ticketTypeId: string; metadata: Prisma.JsonValue | null },
  couponId: string | null | undefined,
  opts: { coupon?: boolean } = {}
): Promise<Prisma.JsonObject> {
  const meta = { ...registrationMeta(reg.metadata) }
  const now = new Date().toISOString()
  if (stockIsClaimed(meta)) {
    await releaseTicketStock(tx, reg.ticketTypeId, ticketQuantity(meta))
    meta[STOCK_RELEASED] = now
  }
  if ((opts.coupon ?? true) && couponId && couponIsClaimed(meta)) {
    await releaseCouponUse(tx, couponId)
    meta[COUPON_RELEASED] = now
  }
  return meta
}

export function holdIsReclaimable(reg: RegistrationState): boolean {
  const meta = registrationMeta(reg.metadata)
  return (
    reg.status === "CANCELLED" &&
    typeof meta.holdReleasedAt === "string" &&
    RECLAIMABLE_RELEASE_REASONS.includes(String(meta.holdReleasedReason))
  )
}

export function countsAgainstCapacity(reg: RegistrationState): boolean {
  return COUNTED_STATUSES.includes(reg.status) || hasActiveHold(reg)
}

// --- Primitive claims and releases --------------------------------------------------

// Takes one seat if the event has room. Events without a capacity always succeed.
export async function claimEventSeat(tx: Tx, eventId: string): Promise<boolean> {
  const event = await tx.event.findUnique({ where: { id: eventId }, select: { maxCapacity: true } })
  if (!event) return false
  return claimEventSeatWithin(tx, eventId, event.maxCapacity)
}

async function claimEventSeatWithin(tx: Tx, eventId: string, maxCapacity: number | null): Promise<boolean> {
  if (!maxCapacity) {
    await tx.event.update({ where: { id: eventId }, data: { currentRegistrations: { increment: 1 } } })
    return true
  }
  const { count } = await tx.event.updateMany({
    where: { id: eventId, currentRegistrations: { lt: maxCapacity } },
    data: { currentRegistrations: { increment: 1 } },
  })
  return count === 1
}

// Waitlisted registrations are counted too; the post-increment value gives a unique
// position even under concurrency. Returns null for events without a capacity.
export async function addToWaitlist(tx: Tx, eventId: string): Promise<number | null> {
  const updated = await tx.event.update({
    where: { id: eventId },
    data: { currentRegistrations: { increment: 1 } },
    select: { currentRegistrations: true, maxCapacity: true },
  })
  return updated.maxCapacity ? Math.max(1, updated.currentRegistrations - updated.maxCapacity) : null
}

export async function releaseEventSeat(tx: Tx, eventId: string): Promise<void> {
  await tx.event.updateMany({
    where: { id: eventId, currentRegistrations: { gt: 0 } },
    data: { currentRegistrations: { decrement: 1 } },
  })
}

// Takes `quantity` tickets from the ticket type (quantity null/0 = unlimited).
// Returns null when the ticket type no longer exists.
export async function claimTicketStock(tx: Tx, ticketTypeId: string, quantity: number): Promise<boolean | null> {
  const ticketType = await tx.ticketType.findUnique({ where: { id: ticketTypeId }, select: { quantity: true } })
  if (!ticketType) return null
  const { count } = await tx.ticketType.updateMany({
    where: {
      id: ticketTypeId,
      ...(ticketType.quantity ? { sold: { lte: ticketType.quantity - quantity } } : {}),
    },
    data: { sold: { increment: quantity } },
  })
  return count === 1
}

export async function releaseTicketStock(tx: Tx, ticketTypeId: string, quantity: number): Promise<void> {
  await tx.ticketType.updateMany({
    where: { id: ticketTypeId, sold: { gte: quantity } },
    data: { sold: { decrement: quantity } },
  })
}

// Takes one coupon use (maxUses null/0 = unlimited).
export async function claimCouponUse(tx: Tx, couponId: string): Promise<boolean> {
  const coupon = await tx.coupon.findUnique({ where: { id: couponId }, select: { maxUses: true } })
  const { count } = await tx.coupon.updateMany({
    where: { id: couponId, ...(coupon?.maxUses ? { currentUses: { lt: coupon.maxUses } } : {}) },
    data: { currentUses: { increment: 1 } },
  })
  return count === 1
}

// Re-takes a use that a hold release gave back. Unconditional: the buyer's price already
// includes the discount.
export async function reclaimCouponUse(tx: Tx, couponId: string): Promise<void> {
  await tx.coupon.updateMany({ where: { id: couponId }, data: { currentUses: { increment: 1 } } })
}

export async function releaseCouponUse(tx: Tx, couponId: string): Promise<void> {
  await tx.coupon.updateMany({
    where: { id: couponId, currentUses: { gt: 0 } },
    data: { currentUses: { decrement: 1 } },
  })
}

// --- New registrations ----------------------------------------------------------------

export type CapacityErrorCode = "EVENT_GONE" | "EVENT_FULL" | "TICKET_GONE" | "TICKETS_SOLD_OUT" | "COUPON_EXHAUSTED"

export class CapacityError extends Error {
  constructor(public readonly code: CapacityErrorCode) {
    super(code)
    this.name = "CapacityError"
  }
}

export const CAPACITY_ERRORS: Record<CapacityErrorCode, { status: number; message: string }> = {
  EVENT_GONE: { status: 404, message: "Event no longer available" },
  EVENT_FULL: { status: 400, message: "Event is full" },
  TICKET_GONE: { status: 400, message: "Ticket type no longer available" },
  TICKETS_SOLD_OUT: { status: 400, message: "Not enough tickets available" },
  COUPON_EXHAUSTED: { status: 400, message: "Coupon has been fully redeemed" },
}

export function capacityErrorCode(error: unknown): CapacityErrorCode | null {
  if (error instanceof CapacityError) return error.code
  const message = (error as Error | undefined)?.message
  return message && message in CAPACITY_ERRORS ? (message as CapacityErrorCode) : null
}

// Claims everything a new registration needs. `countsNow` is true when the registration
// takes a seat immediately (confirmed, or a paid one holding its seat during checkout)
// and false when it only counts later (approval-required). When the event is full the
// registration is waitlisted if the event allows it, otherwise EVENT_FULL is thrown.
export async function claimRegistrationCapacity(
  tx: Tx,
  params: { eventId: string; ticketTypeId: string; quantity: number; countsNow: boolean; couponId?: string | null }
): Promise<{ waitlisted: boolean; waitlistPosition: number | null }> {
  const { eventId, ticketTypeId, quantity, countsNow, couponId } = params

  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: { maxCapacity: true, currentRegistrations: true, waitlistEnabled: true },
  })
  if (!event) throw new CapacityError("EVENT_GONE")

  let waitlisted = false
  let waitlistPosition: number | null = null
  if (event.maxCapacity) {
    const hasRoom = countsNow
      ? await claimEventSeatWithin(tx, eventId, event.maxCapacity)
      // Nothing to claim yet; only refuse (or waitlist) when the event is already full.
      : event.currentRegistrations < event.maxCapacity
    if (!hasRoom) {
      if (!event.waitlistEnabled) throw new CapacityError("EVENT_FULL")
      waitlisted = true
      waitlistPosition = await addToWaitlist(tx, eventId)
    }
  } else if (countsNow) {
    await claimEventSeatWithin(tx, eventId, null)
  }

  const stock = await claimTicketStock(tx, ticketTypeId, quantity)
  if (stock === null) throw new CapacityError("TICKET_GONE")
  if (!stock) throw new CapacityError("TICKETS_SOLD_OUT")

  if (couponId && !(await claimCouponUse(tx, couponId))) {
    throw new CapacityError("COUPON_EXHAUSTED")
  }

  return { waitlisted, waitlistPosition }
}

// --- Refunds ---------------------------------------------------------------------------

// Effects of a full refund on the registration: it is cancelled with its ticket, and its
// seat, ticket stock and coupon use go back (each only if still held). Shared by the
// in-app refund route and the Razorpay refund.processed webhook; callers must guard the
// payment's move to REFUNDED so this runs once per payment.
export async function applyFullRefundEffects(
  tx: Tx,
  params: { registrationId: string; couponId?: string | null; reason?: string }
): Promise<void> {
  const reg = await tx.registration.findUnique({
    where: { id: params.registrationId },
    select: { id: true, status: true, metadata: true, eventId: true, ticketTypeId: true },
  })
  if (!reg) return

  const metadata = await releaseStockAndCoupon(tx, reg, params.couponId)
  await tx.registration.update({
    where: { id: reg.id },
    data: {
      status: "CANCELLED",
      metadata,
      ...(reg.status !== "CANCELLED" ? { cancelledAt: new Date(), cancellationReason: params.reason ?? "Payment refunded" } : {}),
    },
  })
  await tx.ticket.updateMany({ where: { registrationId: reg.id }, data: { status: "CANCELLED" } })
  // A registration that was already cancelled or rejected no longer holds a seat.
  if (countsAgainstCapacity(reg)) await releaseEventSeat(tx, reg.eventId)
}

// --- Registering again ------------------------------------------------------------------

// One registration row per (event, user). A cancelled, rejected or released one is reused
// for a new attempt instead of blocking it, unless money from the earlier attempt is
// still held (paid and not fully refunded, or a payment in flight): the organizer has to
// refund that first.
const REUSABLE_STATUSES: readonly string[] = ["CANCELLED", "REJECTED"]
const HELD_PAYMENT_STATUSES: readonly string[] = ["COMPLETED", "PARTIALLY_REFUNDED", "PROCESSING"]

export type ExistingRegistration = {
  id: string
  status: string
  metadata: Prisma.JsonValue | null
  ticketTypeId: string
  registrationNumber: string
  payment: { id: string; status: string; couponId: string | null; gatewayOrderId: string | null; amount: Prisma.Decimal; currency: string; metadata: Prisma.JsonValue | null } | null
}

export const EXISTING_REGISTRATION_SELECT = {
  id: true, status: true, metadata: true, ticketTypeId: true, registrationNumber: true,
  payment: { select: { id: true, status: true, couponId: true, gatewayOrderId: true, amount: true, currency: true, metadata: true } },
} as const

export function reuseBlocker(existing: ExistingRegistration): "ALREADY_REGISTERED" | "PAYMENT_HELD" | null {
  if (!REUSABLE_STATUSES.includes(existing.status)) return "ALREADY_REGISTERED"
  if (existing.payment && HELD_PAYMENT_STATUSES.includes(existing.payment.status)) return "PAYMENT_HELD"
  return null
}

export class ReuseConflict extends Error {
  constructor() {
    super("ALREADY_REGISTERED")
    this.name = "ReuseConflict"
  }
}

// Takes over a reusable registration inside the transaction: guards on the status that
// was read (a concurrent attempt then gets ReuseConflict) and gives back stock or a
// coupon use the earlier attempt still held. The caller then claims capacity afresh and
// overwrites the row.
export async function takeOverRegistration(tx: Tx, existing: ExistingRegistration): Promise<void> {
  const { count } = await tx.registration.updateMany({
    where: { id: existing.id, status: existing.status as Prisma.EnumRegistrationStatusFilter["equals"] },
    data: { status: "PENDING", metadata: { ...registrationMeta(existing.metadata), reuseStartedAt: new Date().toISOString() } },
  })
  if (count === 0) throw new ReuseConflict()
  await releaseStockAndCoupon(tx, existing, existing.payment?.couponId)
}

// Fields reset when a registration row is reused for a new attempt.
export const FRESH_REGISTRATION_FIELDS = {
  notes: null,
  approvedAt: null,
  approvedBy: null,
  rejectedAt: null,
  rejectedBy: null,
  rejectionReason: null,
  cancelledAt: null,
  cancellationReason: null,
} as const

// Points the earlier attempt's payment row (one per registration) at the new attempt.
// Paid: reset to a fresh PENDING payment. A previous gateway order is kept only when it
// is still payable for exactly the new amount; otherwise it is recorded in
// metadata.previousOrderIds so a late capture on it can be flagged for refund. Free: the
// stale unpaid payment is closed (CANCELLED); a refunded one stays as the record.
export async function resetPaymentForReuse(
  tx: Tx,
  payment: NonNullable<ExistingRegistration["payment"]>,
  next: { amount: number; currency: string; discountAmount: number; couponId: string | null } | null
) {
  const meta = registrationMeta(payment.metadata)
  const history = Array.isArray(meta.history) ? meta.history : []
  const entry = { status: payment.status, amount: Number(payment.amount), couponId: payment.couponId, gatewayOrderId: payment.gatewayOrderId, replacedAt: new Date().toISOString() }
  if (!next) {
    // The coupon belonged to the earlier attempt (its use was given back above).
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        ...(payment.status === "REFUNDED" ? {} : { status: "CANCELLED" }),
        couponId: null,
        metadata: { ...meta, history: [...history, entry].slice(-20) },
      },
    })
    return null
  }

  const keepOrder =
    !!payment.gatewayOrderId &&
    payment.status !== "REFUNDED" &&
    Number(payment.amount) === next.amount &&
    payment.currency === next.currency
  const previousOrderIds = Array.isArray(meta.previousOrderIds) ? meta.previousOrderIds : []
  return tx.payment.update({
    where: { id: payment.id },
    data: {
      amount: next.amount,
      currency: next.currency,
      status: "PENDING",
      method: "RAZORPAY",
      discountAmount: next.discountAmount > 0 ? next.discountAmount : null,
      couponId: next.couponId,
      gatewayOrderId: keepOrder ? payment.gatewayOrderId : null,
      gatewayPaymentId: null,
      gatewaySignature: null,
      paidAt: null,
      failedAt: null,
      failureReason: null,
      refundId: null,
      refundAmount: null,
      refundReason: null,
      refundedAt: null,
      metadata: {
        ...meta,
        previousOrderIds: !keepOrder && payment.gatewayOrderId ? [...previousOrderIds, payment.gatewayOrderId].slice(-20) : previousOrderIds,
        history: [...history, entry].slice(-20),
      },
    },
  })
}

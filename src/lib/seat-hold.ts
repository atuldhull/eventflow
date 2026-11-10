import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import {
  COUPON_RELEASED,
  RELEASE_KEYS,
  SEAT_HOLD_MS,
  STOCK_RELEASED,
  claimEventSeat,
  claimTicketStock,
  couponIsClaimed,
  hasActiveHold,
  holdExpiresAt,
  holdIsReclaimable,
  registrationMeta,
  releaseCouponUse,
  releaseEventSeat,
  releaseTicketStock,
  reclaimCouponUse,
  stockIsClaimed,
  ticketQuantity,
  withoutKeys,
  type HoldReleaseReason,
} from "@/lib/registration-capacity"

// Seat holds for paid registrations. A registration that awaits payment claims its
// event seat, ticket stock and coupon use at creation, exactly like a confirmed one,
// and records metadata.holdExpiresAt. If the payment isn't completed by then, the hold
// is released by the release-holds cron, lazily by POST /api/registrations for the
// same event, by the payment.failed webhook, or by an explicit cancel.
//
// Lock order: every path that touches both rows (release here, completion in
// payment-completion.ts) updates the payment row before the registration row, so a
// release racing a completion serialises on the payment instead of deadlocking.

type Tx = Prisma.TransactionClient

const OPEN_PAYMENT_STATUSES = ["PENDING", "PROCESSING"] as const

const FAILURE_REASONS: Record<HoldReleaseReason, string> = {
  expired: "Seat hold expired before payment was completed",
  payment_failed: "Payment failed",
  cancelled: "Registration cancelled before payment",
  rejected: "Registration rejected before payment",
}

export function newHoldExpiry(from = new Date()): string {
  return new Date(from.getTime() + SEAT_HOLD_MS).toISOString()
}

class HoldConflict extends Error {}

// Releases the hold inside the caller's transaction. Returns false (and changes nothing)
// when there is no active hold, when `onlyIfExpiredBy` is given and the hold hasn't
// expired by then, or when the payment was completed first.
export async function releaseSeatHoldInTx(
  tx: Tx,
  registrationId: string,
  reason: HoldReleaseReason,
  opts: { status?: "CANCELLED" | "REJECTED"; onlyIfExpiredBy?: Date; data?: Prisma.RegistrationUpdateManyMutationInput } = {}
): Promise<boolean> {
  const reg = await tx.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true, status: true, metadata: true, eventId: true, ticketTypeId: true,
      payment: { select: { id: true, couponId: true } },
    },
  })
  if (!reg || !hasActiveHold(reg)) return false
  if (opts.onlyIfExpiredBy) {
    const expiresAt = holdExpiresAt(reg)
    if (expiresAt && expiresAt > opts.onlyIfExpiredBy) return false
  }

  const now = new Date()

  // 1. The payment: only an open (or already failed) payment may lose its seat. This
  //    UPDATE also takes the payment row lock; a completion holding it makes us wait,
  //    then match nothing.
  if (reg.payment) {
    const opened = await tx.payment.updateMany({
      where: { id: reg.payment.id, status: { in: [...OPEN_PAYMENT_STATUSES] } },
      data: { status: "FAILED", failedAt: now, failureReason: FAILURE_REASONS[reason] },
    })
    if (opened.count === 0) {
      const failed = await tx.payment.updateMany({
        where: { id: reg.payment.id, status: "FAILED" },
        data: { status: "FAILED" },
      })
      if (failed.count === 0) return false
    }
  }

  // 2. The registration, guarded on PENDING so concurrent releases apply once. The
  //    metadata records which claims are given back, so nothing returns them twice.
  const status = opts.status ?? "CANCELLED"
  const meta = registrationMeta(reg.metadata)
  const couponId = reg.payment?.couponId
  const releaseStock = stockIsClaimed(meta)
  const releaseCoupon = !!couponId && couponIsClaimed(meta)
  const at = now.toISOString()
  const { count } = await tx.registration.updateMany({
    where: { id: reg.id, status: "PENDING" },
    data: {
      status,
      ...(status === "CANCELLED"
        ? { cancelledAt: now, cancellationReason: FAILURE_REASONS[reason] }
        : { rejectedAt: now }),
      ...opts.data,
      metadata: {
        ...meta,
        holdReleasedAt: at,
        holdReleasedReason: reason,
        ...(releaseStock ? { [STOCK_RELEASED]: at } : {}),
        ...(releaseCoupon ? { [COUPON_RELEASED]: at } : {}),
      },
    },
  })
  if (count === 0) throw new HoldConflict("Registration changed while releasing its hold")

  // 3. Give everything the hold claimed back.
  await releaseEventSeat(tx, reg.eventId)
  if (releaseStock) await releaseTicketStock(tx, reg.ticketTypeId, ticketQuantity(meta))
  if (releaseCoupon) await releaseCouponUse(tx, couponId!)
  return true
}

export async function releaseSeatHold(
  registrationId: string,
  reason: HoldReleaseReason,
  opts: { onlyIfExpiredBy?: Date } = {}
): Promise<boolean> {
  try {
    return await prisma.$transaction((tx) => releaseSeatHoldInTx(tx, registrationId, reason, opts))
  } catch (error) {
    if (error instanceof HoldConflict) return false
    throw error
  }
}

// Releases holds whose expiry has passed. Scope it with eventId (lazy release before a
// capacity check) or registrationId; with neither it sweeps everything (cron). Each hold
// is released in its own transaction, so one failure doesn't block the rest.
export async function releaseExpiredHolds(
  opts: { eventId?: string; registrationId?: string; limit?: number; now?: Date } = {}
): Promise<{ released: number; failed: number }> {
  const now = opts.now ?? new Date()
  const candidates = await prisma.registration.findMany({
    where: {
      status: "PENDING",
      // ISO-8601 UTC strings of one fixed format sort chronologically.
      metadata: { path: ["holdExpiresAt"], lt: now.toISOString() },
      ...(opts.eventId ? { eventId: opts.eventId } : {}),
      ...(opts.registrationId ? { id: opts.registrationId } : {}),
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 200,
  })

  let released = 0
  let failed = 0
  for (const { id } of candidates) {
    try {
      if (await releaseSeatHold(id, "expired", { onlyIfExpiredBy: now })) released++
    } catch (error) {
      failed++
      console.error(`Releasing expired seat hold for registration ${id} failed:`, error)
    }
  }
  return { released, failed }
}

export type Rehold = { ok: true; holdExpiresAt: string } | { ok: false; reason: "EVENT_FULL" | "TICKETS_SOLD_OUT" | "NOT_RELEASED" }

// Puts a fresh hold on a registration whose hold expired or whose payment failed, so the
// buyer can try paying again. Claims are conditional: if the seat has gone meanwhile the
// registration stays cancelled.
export async function reholdReleasedRegistration(registrationId: string): Promise<Rehold> {
  try {
    return await prisma.$transaction(async (tx): Promise<Rehold> => {
      const reg = await tx.registration.findUnique({
        where: { id: registrationId },
        select: {
          id: true, status: true, metadata: true, eventId: true, ticketTypeId: true,
          payment: { select: { id: true, couponId: true } },
        },
      })
      if (!reg || !reg.payment || !holdIsReclaimable(reg)) return { ok: false, reason: "NOT_RELEASED" }

      // Payment first (lock order), and only from FAILED: a completed one needs no hold.
      const reopened = await tx.payment.updateMany({
        where: { id: reg.payment.id, status: "FAILED" },
        data: { status: "PENDING", failedAt: null, failureReason: null },
      })
      if (reopened.count === 0) return { ok: false, reason: "NOT_RELEASED" }

      const meta = registrationMeta(reg.metadata)
      const expiry = newHoldExpiry()
      const { count } = await tx.registration.updateMany({
        where: { id: reg.id, status: "CANCELLED" },
        data: {
          status: "PENDING",
          cancelledAt: null,
          cancellationReason: null,
          metadata: { ...withoutKeys(meta, RELEASE_KEYS), holdExpiresAt: expiry },
        },
      })
      if (count === 0) throw new HoldConflict("Registration changed while re-holding")

      if (!(await claimEventSeat(tx, reg.eventId))) throw new ReholdRefused("EVENT_FULL")
      if (!stockIsClaimed(meta) && !(await claimTicketStock(tx, reg.ticketTypeId, ticketQuantity(meta)))) {
        throw new ReholdRefused("TICKETS_SOLD_OUT")
      }
      // The price was fixed with the discount, so the coupon use is taken back as is.
      if (reg.payment.couponId && !couponIsClaimed(meta)) await reclaimCouponUse(tx, reg.payment.couponId)

      return { ok: true, holdExpiresAt: expiry }
    })
  } catch (error) {
    if (error instanceof ReholdRefused) return { ok: false, reason: error.reason }
    if (error instanceof HoldConflict) return { ok: false, reason: "NOT_RELEASED" }
    throw error
  }
}

class ReholdRefused extends Error {
  constructor(public readonly reason: "EVENT_FULL" | "TICKETS_SOLD_OUT") {
    super(reason)
  }
}

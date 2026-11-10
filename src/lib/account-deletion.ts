import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { countsAgainstCapacity, hasActiveHold, releaseEventSeat, releaseStockAndCoupon } from "@/lib/registration-capacity"
import { releaseSeatHoldInTx } from "@/lib/seat-hold"

/**
 * "Delete my account" (DPDP Act 2023, right to erasure).
 *
 * The user row is anonymised rather than removed: payments must be kept for GST and tax
 * records, and registrations, payments, events and audit entries point at the row. What
 * identifies the person is cleared, every way of signing in is removed, and the row is
 * marked inactive and deleted, which src/lib/auth.ts refuses at sign-in and on every
 * session check. Open registrations for events that haven't ended are cancelled and their
 * seats, ticket stock and coupon uses given back with the same helpers the attendee's own
 * cancel uses.
 */

type Tx = Prisma.TransactionClient

export const DELETED_USER_NAME = "Deleted user"
export const DELETE_CONFIRMATION_WORD = "DELETE"

/** Registrations that still expect to attend and are cancelled with the account. */
const OPEN_REGISTRATION_STATUSES = ["PENDING", "CONFIRMED", "WAITLISTED"] as const
/** Events in these states no longer need anyone to run them. */
const FINISHED_EVENT_STATUSES = ["CANCELLED", "COMPLETED"] as const

export function anonymisedEmail(userId: string): string {
  return `deleted-${userId}@deleted.invalid`
}

// --- Confirmation ----------------------------------------------------------------------

export type ConfirmationResult = { ok: true } | { ok: false; status: number; message: string }

/**
 * Accounts with a password confirm with it; accounts that only sign in through Google or
 * Microsoft type DELETE or their email address instead.
 */
export async function checkDeletionConfirmation(
  user: { email: string; passwordHash: string | null },
  input: { password?: unknown; confirmation?: unknown }
): Promise<ConfirmationResult> {
  if (user.passwordHash) {
    if (typeof input.password !== "string" || !input.password) {
      return { ok: false, status: 400, message: "Enter your password to confirm" }
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash)
    return valid ? { ok: true } : { ok: false, status: 400, message: "Password is incorrect" }
  }
  const typed = typeof input.confirmation === "string" ? input.confirmation.trim() : ""
  if (typed === DELETE_CONFIRMATION_WORD || (typed && typed.toLowerCase() === user.email.toLowerCase())) {
    return { ok: true }
  }
  return { ok: false, status: 400, message: `Type ${DELETE_CONFIRMATION_WORD} or your email address to confirm` }
}

// --- Ownership checks ------------------------------------------------------------------

export type DeletionBlocker = { kind: "enterprise" | "organization" | "platform"; id: string; name: string }

function activeEventsWhere(now: Date): Prisma.EventWhereInput {
  return { deletedAt: null, status: { notIn: [...FINISHED_EVENT_STATUSES] }, endDate: { gte: now } }
}

/**
 * What the account still has to hand over before it can be deleted:
 * - an enterprise it owns (Enterprise.ownerId) that has other active members or events
 *   that haven't finished;
 * - an organization where it is the only active ORG_ADMIN (organizations have no owner
 *   field) and that has other active members or unfinished events;
 * - the platform itself, when it is the last active super admin.
 */
export async function findDeletionBlockers(userId: string, now = new Date()): Promise<DeletionBlocker[]> {
  const blockers: DeletionBlocker[] = []

  const enterprises = await prisma.enterprise.findMany({
    where: { ownerId: userId, deletedAt: null },
    select: {
      id: true, name: true,
      _count: {
        select: {
          members: { where: { isActive: true, userId: { not: userId } } },
          events: { where: activeEventsWhere(now) },
        },
      },
    },
  })
  for (const e of enterprises) {
    if (e._count.members > 0 || e._count.events > 0) blockers.push({ kind: "enterprise", id: e.id, name: e.name })
  }

  const adminOf = await prisma.organizationMember.findMany({
    where: { userId, role: "ORG_ADMIN", isActive: true, organization: { deletedAt: null } },
    select: {
      organization: {
        select: {
          id: true, name: true,
          members: { where: { isActive: true, userId: { not: userId } }, select: { role: true } },
          _count: { select: { events: { where: activeEventsWhere(now) } } },
        },
      },
    },
  })
  for (const { organization: org } of adminOf) {
    const otherAdmin = org.members.some((m) => m.role === "ORG_ADMIN")
    if (!otherAdmin && (org.members.length > 0 || org._count.events > 0)) {
      blockers.push({ kind: "organization", id: org.id, name: org.name })
    }
  }

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (me?.role === "SUPER_ADMIN") {
    const others = await prisma.user.count({
      where: { role: "SUPER_ADMIN", isActive: true, deletedAt: null, id: { not: userId } },
    })
    if (others === 0) blockers.push({ kind: "platform", id: "platform", name: "EventFlow" })
  }

  return blockers
}

export function blockerMessage(blockers: DeletionBlocker[]): string {
  if (blockers.some((b) => b.kind === "platform")) {
    return "You are the only super admin. Make someone else a super admin before deleting your account."
  }
  const names = blockers.map((b) => b.name).join(", ")
  return `You are the only owner of ${names}. Transfer ownership or make someone else an admin first, then delete your account.`
}

// --- Cancelling open registrations ------------------------------------------------------

/**
 * Cancels one open registration inside the deletion transaction, exactly as the
 * attendee's own cancel does: a seat hold is released (open payment closed), otherwise
 * the ticket is voided and the seat, ticket stock and coupon use go back once.
 */
async function cancelOpenRegistration(
  tx: Tx,
  reg: { id: string; status: string; eventId: string; metadata: Prisma.JsonValue | null; payment: { couponId: string | null } | null }
): Promise<boolean> {
  if (hasActiveHold(reg) && (await releaseSeatHoldInTx(tx, reg.id, "cancelled"))) {
    await tx.ticket.updateMany({ where: { registrationId: reg.id, status: "ACTIVE" }, data: { status: "CANCELLED" } })
    return true
  }

  const current = await tx.registration.findUnique({ where: { id: reg.id }, select: { status: true, metadata: true, ticketTypeId: true } })
  if (!current || !(OPEN_REGISTRATION_STATUSES as readonly string[]).includes(current.status)) return false
  const { count } = await tx.registration.updateMany({
    where: { id: reg.id, status: current.status },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: "Account deleted" },
  })
  if (count === 0) return false
  await tx.ticket.updateMany({ where: { registrationId: reg.id, status: "ACTIVE" }, data: { status: "CANCELLED" } })
  if (countsAgainstCapacity(current)) await releaseEventSeat(tx, reg.eventId)
  const metadata = await releaseStockAndCoupon(tx, current, reg.payment?.couponId)
  await tx.registration.update({ where: { id: reg.id }, data: { metadata } })
  return true
}

// --- Deleting ---------------------------------------------------------------------------

export type DeleteAccountResult =
  | { ok: true; cancelledRegistrations: number }
  | { ok: false; status: number; message: string }

/** The anonymised user row: nothing that identifies the person, and no way to sign in. */
export function anonymisedUserData(userId: string, now: Date): Prisma.UserUpdateManyMutationInput {
  return {
    name: DELETED_USER_NAME,
    email: anonymisedEmail(userId),
    emailVerified: null,
    phone: null,
    phoneVerified: false,
    passwordHash: null,
    firstName: null,
    lastName: null,
    avatar: null,
    bio: null,
    role: "USER",
    isActive: false,
    banReason: null,
    lastLoginAt: null,
    lastLoginIp: null,
    collegeName: null,
    companyName: null,
    designation: null,
    city: null,
    state: null,
    country: null,
    dateOfBirth: null,
    gender: null,
    interests: [],
    metadata: { accountDeletedAt: now.toISOString() },
    twoFactorEnabled: false,
    twoFactorSecret: null,
    deletedAt: now,
  }
}

class AlreadyDeleted extends Error {}

/**
 * Anonymises the account in one transaction. The caller has already checked the
 * confirmation; ownership is checked here so nothing changes while it blocks.
 */
export async function deleteAccount(userId: string, now = new Date()): Promise<DeleteAccountResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, deletedAt: true } })
  if (!user || user.deletedAt) return { ok: false, status: 404, message: "Account not found" }

  const blockers = await findDeletionBlockers(userId, now)
  if (blockers.length > 0) return { ok: false, status: 409, message: blockerMessage(blockers) }

  let cancelledRegistrations = 0
  try {
    await prisma.$transaction(async (tx) => {
      // Open registrations for events that haven't ended: cancel, void tickets, free seats.
      const open = await tx.registration.findMany({
        where: { userId, status: { in: [...OPEN_REGISTRATION_STATUSES] }, event: { endDate: { gte: now } } },
        select: { id: true, status: true, eventId: true, metadata: true, payment: { select: { couponId: true } } },
      })
      for (const reg of open) {
        if (await cancelOpenRegistration(tx, reg)) cancelledRegistrations++
      }

      // Personal data the organizers' records don't need. Payments, registrations,
      // tickets and certificates stay (tax law, attendance history) but lose the name and
      // the answers the person typed in.
      await tx.registration.updateMany({ where: { userId }, data: { formResponses: Prisma.DbNull, notes: null } })
      await tx.certificate.updateMany({ where: { userId }, data: { recipientName: DELETED_USER_NAME } })
      await tx.feedback.updateMany({ where: { userId }, data: { isAnonymous: true } })
      await tx.contactMessage.updateMany({ where: { userId }, data: { name: DELETED_USER_NAME, email: anonymisedEmail(userId) } })
      await tx.auditLog.updateMany({ where: { userId }, data: { ipAddress: null, userAgent: null } })

      // Memberships, saved events, notifications, waitlist places.
      await tx.organizationMember.deleteMany({ where: { userId } })
      await tx.enterpriseMember.deleteMany({ where: { userId } })
      await tx.eventTeamMember.deleteMany({ where: { userId } })
      await tx.savedEvent.deleteMany({ where: { userId } })
      await tx.notification.deleteMany({ where: { userId } })
      await tx.waitlistEntry.deleteMany({ where: { userId } })

      // Every way of signing in.
      await tx.session.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })
      await tx.refreshToken.deleteMany({ where: { userId } })
      await tx.oTP.deleteMany({ where: { OR: [{ userId }, { email: user.email }] } })
      await tx.verificationToken.deleteMany({ where: { identifier: user.email } })

      // Last, guarded so two deletes racing apply once.
      const { count } = await tx.user.updateMany({ where: { id: userId, deletedAt: null }, data: anonymisedUserData(userId, now) })
      if (count === 0) throw new AlreadyDeleted()
    })
  } catch (error) {
    if (error instanceof AlreadyDeleted) return { ok: false, status: 404, message: "Account not found" }
    throw error
  }

  // No personal data: the row it points at is already anonymised.
  await createAuditLog({
    userId,
    action: "DELETE",
    entityType: "USER",
    entityId: userId,
    description: "Account deleted at the user's request",
    newValues: { cancelledRegistrations },
  })

  return { ok: true, cancelledRegistrations }
}

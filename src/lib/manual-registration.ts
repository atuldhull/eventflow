import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { z } from "zod/v4"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { createNotification } from "@/lib/notifications"
import {
  CAPACITY_ERRORS,
  EXISTING_REGISTRATION_SELECT,
  FRESH_REGISTRATION_FIELDS,
  ReuseConflict,
  capacityErrorCode,
  claimRegistrationCapacity,
  resetPaymentForReuse,
  reuseBlocker,
  takeOverRegistration,
} from "@/lib/registration-capacity"
import { issueFreeTicket } from "@/lib/registration-ticket"
import { releaseExpiredHolds } from "@/lib/seat-hold"

// An organizer registers someone by hand ("Add participant"). It goes through the same
// steps as a free registration on POST /api/registrations: the registrant's account is
// found by email or created the way guest checkout creates one, an earlier cancelled or
// rejected registration is reused, every capacity counter is claimed with the shared
// conditional claims (never overbooking), and a confirmed registration gets its ticket
// and a confirmation email. Differences, all organizer overrides: the registration
// window and invite-only membership are not checked, a paid ticket type is issued as a
// complimentary ticket (no payment is collected), and the organizer's add counts as the
// approval on approval-required events when they may approve registrations.

export const manualRegistrationSchema = z.object({
  eventId: z.string().trim().min(1, "Event is required").max(64),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  ticketTypeId: z.string().trim().min(1, "Choose a ticket type").max(64),
})

export type ManualRegistrationInput = z.infer<typeof manualRegistrationSchema>

/** Event states an organizer may add participants to (the public window is ignored). */
export const MANUAL_REGISTRATION_EVENT_STATUSES: readonly string[] = [
  "PUBLISHED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "ONGOING",
]

export type ManualRegistrationResult =
  | {
      ok: true
      registrationId: string
      registrationNumber: string
      status: "PENDING" | "CONFIRMED" | "WAITLISTED"
      userId: string
      complimentary: boolean
    }
  | { ok: false; status: number; message: string }

export function generateRegistrationNumber(): string {
  return `EVT-${new Date().getFullYear()}-${crypto.randomInt(0, 100000).toString().padStart(5, "0")}`
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)

function isUniqueViolation(error: unknown, column: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes(column)
  )
}

export async function addParticipantManually(params: {
  orgId: string
  actorId: string
  /** The actor may approve registrations (their add then counts as the approval). */
  canApprove: boolean
  input: ManualRegistrationInput
  client?: { ipAddress?: string; userAgent?: string }
}): Promise<ManualRegistrationResult> {
  const { orgId, actorId, canApprove, input, client } = params
  const { eventId, ticketTypeId, name, email } = input

  // Scoped to the authorized organization: another tenant's event is simply not found.
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId, deletedAt: null },
    select: { id: true, title: true, status: true, approvalRequired: true, settings: true, enterpriseId: true },
  })
  if (!event) return { ok: false, status: 404, message: "Event not found" }

  if (!MANUAL_REGISTRATION_EVENT_STATUSES.includes(event.status)) {
    return {
      ok: false,
      status: 400,
      message: event.status === "DRAFT" || event.status === "PENDING_APPROVAL"
        ? "Publish the event before adding participants."
        : "Participants can't be added to a cancelled, postponed or completed event.",
    }
  }

  // The event's email domain restriction applies to added participants too.
  const settings = (event.settings && typeof event.settings === "object" && !Array.isArray(event.settings)
    ? event.settings
    : {}) as Record<string, unknown>
  if (typeof settings.allowedEmailDomains === "string") {
    const domains = settings.allowedEmailDomains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean)
    const domain = email.split("@")[1]?.toLowerCase()
    if (domains.length > 0 && (!domain || !domains.includes(domain))) {
      return { ok: false, status: 403, message: `This event only accepts ${domains.join(", ")} email addresses.` }
    }
  }

  const ticketType = await prisma.ticketType.findFirst({
    where: { id: ticketTypeId, eventId, isActive: true },
    select: { id: true, name: true, price: true },
  })
  if (!ticketType) return { ok: false, status: 400, message: "Choose an active ticket type for this event." }
  const complimentary = Number(ticketType.price) > 0

  // Abandoned checkouts must not keep the event full (as on POST /api/registrations).
  try {
    await releaseExpiredHolds({ eventId })
  } catch (error) {
    console.error("Releasing expired seat holds failed:", error)
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  const existing = existingUser
    ? await prisma.registration.findUnique({
        where: { eventId_userId: { eventId, userId: existingUser.id } },
        select: EXISTING_REGISTRATION_SELECT,
      })
    : null
  const blocker = existing ? reuseBlocker(existing) : null
  if (blocker === "ALREADY_REGISTERED") {
    return { ok: false, status: 409, message: `${email} is already registered for this event.` }
  }
  if (blocker === "PAYMENT_HELD") {
    return { ok: false, status: 409, message: `${email} has an earlier paid registration for this event that hasn't been refunded yet.` }
  }

  const awaitsApproval = event.approvalRequired && !canApprove

  let outcome: { registrationId: string; registrationNumber: string; status: "PENDING" | "CONFIRMED" | "WAITLISTED"; userId: string } | null = null
  try {
    for (let attempt = 0; attempt < 3 && !outcome; attempt++) {
      const registrationNumber = existing?.registrationNumber ?? generateRegistrationNumber()
      try {
        outcome = await prisma.$transaction(async (tx) => {
          // An unknown email gets an account, exactly as guest checkout creates one (no
          // password: signing up later with this email takes it over). Created inside the
          // transaction, so a refused add (event full, sold out) leaves no account behind.
          const userId = existingUser?.id ?? (await tx.user.upsert({
            where: { email },
            update: {},
            create: { email, name, role: "USER" },
            select: { id: true },
          })).id

          if (existing) await takeOverRegistration(tx, existing)

          // Same conditional claims as every other registration: seat (or waitlist), ticket
          // stock. An approval-required add by someone who can't approve only counts once
          // approved, like a public one.
          const { waitlisted, waitlistPosition } = await claimRegistrationCapacity(tx, {
            eventId,
            ticketTypeId,
            quantity: 1,
            countsNow: !awaitsApproval,
          })

          const status: "PENDING" | "CONFIRMED" | "WAITLISTED" = waitlisted ? "WAITLISTED" : awaitsApproval ? "PENDING" : "CONFIRMED"
          const now = new Date()
          const fields = {
            ticketTypeId,
            status,
            type: "INDIVIDUAL" as const,
            teamId: null,
            source: "ORGANIZER",
            waitlistPosition,
            ...(status === "CONFIRMED" && event.approvalRequired ? { approvedAt: now, approvedBy: actorId } : {}),
            metadata: {
              ticketQuantity: 1,
              addedBy: actorId,
              addedAt: now.toISOString(),
              ...(complimentary ? { complimentary: true } : {}),
              ...(existing ? { reregisteredAt: now.toISOString(), previousStatus: existing.status } : {}),
            },
          }
          const reg = existing
            ? await tx.registration.update({ where: { id: existing.id }, data: { ...FRESH_REGISTRATION_FIELDS, ...fields } })
            : await tx.registration.create({ data: { ...fields, registrationNumber, eventId, userId } })

          // Free (or complimentary) and confirmed: the ticket is issued now, as for a free registration.
          if (status === "CONFIRMED") {
            await issueFreeTicket(tx, { registrationId: reg.id, ticketTypeId, userId, eventId })
          }
          // A reused registration's stale payment row is closed: nothing is charged.
          if (existing?.payment) await resetPaymentForReuse(tx, existing.payment, null)

          return { registrationId: reg.id, registrationNumber: reg.registrationNumber, status, userId }
        })
      } catch (error) {
        // A random registration number collided: try again with a new one.
        if (!existing && isUniqueViolation(error, "registration_number")) continue
        throw error
      }
    }
  } catch (error) {
    if (error instanceof ReuseConflict || isUniqueViolation(error, "user")) {
      return { ok: false, status: 409, message: `${email} is already registered for this event.` }
    }
    const code = capacityErrorCode(error)
    if (code) return { ok: false, status: CAPACITY_ERRORS[code].status, message: CAPACITY_ERRORS[code].message }
    throw error
  }
  if (!outcome) return { ok: false, status: 409, message: "Couldn't allocate a registration number. Try again." }

  // Notifications: the same confirmation email a free registration gets, plus an in-app note.
  const subject = outcome.status === "CONFIRMED"
    ? `Registration Confirmed — ${event.title}`
    : outcome.status === "WAITLISTED"
      ? `You're on the Waitlist — ${event.title}`
      : `Registration Received — ${event.title}`
  try {
    await sendEmail({
      to: email,
      subject,
      html: `<h2>${escapeHtml(subject)}</h2><p>Hi ${escapeHtml(name)}, the organizer has registered you for this event.</p><p>Registration #: ${escapeHtml(outcome.registrationNumber)}</p><p>Event: ${escapeHtml(event.title)}</p>`,
    })
  } catch (error) {
    console.error("Manual registration email failed:", error)
  }
  try {
    await createNotification({
      userId: outcome.userId,
      type: "IN_APP",
      category: "REGISTRATION",
      title: outcome.status === "CONFIRMED" ? "Registration Confirmed" : outcome.status === "WAITLISTED" ? "Added to the Waitlist" : "Registration Received",
      message: `You were registered for ${event.title} by the organizer. Registration #: ${outcome.registrationNumber}`,
      data: { actionUrl: "/dashboard/tickets" },
      eventId,
      senderId: actorId,
    })
  } catch (error) {
    console.error("Manual registration notification failed:", error)
  }

  await createAuditLog({
    userId: actorId,
    action: "CREATE",
    entityType: "REGISTRATION",
    entityId: outcome.registrationId,
    description: `Added ${email} to ${event.title} (${ticketType.name}${complimentary ? ", complimentary" : ""}) as ${outcome.status.toLowerCase()}`,
    newValues: { email, name, ticketTypeId, status: outcome.status, source: "ORGANIZER" },
    ipAddress: client?.ipAddress,
    userAgent: client?.userAgent,
    eventId,
    organizationId: orgId,
    enterpriseId: event.enterpriseId ?? undefined,
  })

  return { ok: true, ...outcome, complimentary }
}

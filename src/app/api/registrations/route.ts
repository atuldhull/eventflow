import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { createRegistrationSchema } from "@/lib/validations/registration"
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
import { issueTicketViewLink, publicTicket } from "@/lib/ticket-view-token"
import { liveWorkspaceWhere } from "@/lib/public-events"
import { escapeHtml } from "@/lib/escape-html"
import { newHoldExpiry, releaseExpiredHolds } from "@/lib/seat-hold"
import { rateLimiter, RATE_LIMITS } from "@/lib/rate-limiter"
import { z } from "zod/v4"
import crypto from "crypto"

const guestSchema = z.object({
  guestEmail: z.string().trim().toLowerCase().pipe(z.email()),
  guestName: z.string().trim().min(2).max(100),
})

function generateRegistrationNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 99999).toString().padStart(5, "0")
  return `EVT-${year}-${random}`
}

export async function POST(request: NextRequest) {
  const session = await auth()

  try {
    const body = await request.json()

    const parsed = createRegistrationSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Guest checkout (free tickets only): a signed-out visitor gives a name and email
    // instead of an account. The middleware lets this POST through without a session.
    let guest: { email: string; name: string } | null = null
    let userId = session?.user?.id
    if (!userId) {
      const guestParsed = guestSchema.safeParse(body)
      if (!guestParsed.success) {
        return NextResponse.json({ success: false, message: "Please provide your name and email, or log in to register" }, { status: 400 })
      }
      const limit = await rateLimiter.check(`guest-registration:${getClientInfo(request).ipAddress}`, RATE_LIMITS.registration.limit, RATE_LIMITS.registration.windowMs)
      if (!limit.allowed) {
        return NextResponse.json({ success: false, message: "Too many registrations. Please try again in a minute." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 60) } })
      }
      guest = { email: guestParsed.data.guestEmail, name: guestParsed.data.guestName }
      // An existing account with this email gets the registration. A new one is only
      // created once every check below has passed, so a refused request leaves no user behind.
      userId = (await prisma.user.findUnique({ where: { email: guest.email }, select: { id: true } }))?.id
    }

    const { eventId, ticketTypeId, quantity, formResponses, teamId, couponCode } = parsed.data

    // Fetch event. A deleted event, or one whose organization or enterprise is deactivated
    // or deleted, takes no registrations: it answers "Event not found" like its public page.
    const event = await prisma.event.findUnique({
      where: { id: eventId, deletedAt: null, ...liveWorkspaceWhere() },
      select: {
        id: true, title: true, slug: true, status: true, visibility: true, maxCapacity: true,
        currentRegistrations: true, waitlistEnabled: true, approvalRequired: true,
        isPaid: true, registrationStartDate: true, registrationEndDate: true,
        organizationId: true, enterpriseId: true, termsAndConditions: true, settings: true,
      },
    })

    if (!event) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
    }

    // A guest can't prove membership or an invitation: private events need an account
    if (guest && event.visibility !== "PUBLIC" && event.visibility !== "UNLISTED") {
      return NextResponse.json({ success: false, message: "Please log in to register for this event." }, { status: 401 })
    }

    // Enforce INVITE_ONLY visibility — only org/enterprise members can register
    if (event.visibility === "INVITE_ONLY") {
      const isMember = event.organizationId ? await prisma.organizationMember.findFirst({
        where: { userId: userId, organizationId: event.organizationId, isActive: true },
      }) : null
      const isEntMember = event.enterpriseId ? await prisma.enterpriseMember.findFirst({
        where: { userId: userId, enterpriseId: event.enterpriseId, isActive: true },
      }) : null
      if (!isMember && !isEntMember) {
        return NextResponse.json({ success: false, message: "This is an invite-only event. You need an invitation to register." }, { status: 403 })
      }
    }

    // Check event is open
    const validStatuses = ["PUBLISHED", "REGISTRATION_OPEN"]
    if (!validStatuses.includes(event.status)) {
      return NextResponse.json({ success: false, message: "Registration is not open for this event" }, { status: 400 })
    }

    // Enforce email domain restriction (corporate events)
    const settings = event.settings as any
    if (settings?.allowedEmailDomains) {
      const domains = (settings.allowedEmailDomains as string).split(",").map((d: string) => d.trim().toLowerCase()).filter(Boolean)
      if (domains.length > 0) {
        const registrantEmail = guest
          ? guest.email
          : (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email
        const userDomain = registrantEmail?.split("@")[1]?.toLowerCase()
        if (!userDomain || !domains.includes(userDomain)) {
          return NextResponse.json({ success: false, message: `Registration is restricted to ${domains.join(", ")} email addresses.` }, { status: 403 })
        }
      }
    }

    // Check registration window
    const now = new Date()
    if (event.registrationStartDate && now < event.registrationStartDate) {
      return NextResponse.json({ success: false, message: "Registration has not opened yet" }, { status: 400 })
    }
    if (event.registrationEndDate && now > event.registrationEndDate) {
      return NextResponse.json({ success: false, message: "Registration has closed" }, { status: 400 })
    }

    // Release expired seat holds for this event first: abandoned checkouts must not keep it
    // full (even when the cron isn't running), and the buyer's own expired hold must not
    // block them from registering again.
    try {
      await releaseExpiredHolds({ eventId })
    } catch (error) {
      console.error("Releasing expired seat holds failed:", error)
    }

    // Check if already registered. A cancelled, rejected or released registration is
    // reused for this new attempt (one row per event and user).
    const existing = userId
      ? await prisma.registration.findUnique({
          where: { eventId_userId: { eventId, userId } },
          select: EXISTING_REGISTRATION_SELECT,
        })
      : null
    const blocker = existing ? reuseBlocker(existing) : null
    if (blocker === "ALREADY_REGISTERED") {
      return NextResponse.json({ success: false, message: "You are already registered for this event" }, { status: 409 })
    }
    if (blocker === "PAYMENT_HELD") {
      return NextResponse.json({ success: false, message: "Your earlier registration for this event has a payment that hasn't been refunded yet. Please contact the organizer." }, { status: 409 })
    }

    // Validate ticket type
    const ticketType = await prisma.ticketType.findFirst({
      where: { id: ticketTypeId, eventId, isActive: true },
    })
    if (!ticketType) {
      return NextResponse.json({ success: false, message: "Invalid ticket type" }, { status: 400 })
    }

    if (quantity > ticketType.maxPerUser) {
      return NextResponse.json({ success: false, message: `Maximum ${ticketType.maxPerUser} tickets per person` }, { status: 400 })
    }

    // Payments are tied to an account (create-order and verify require a session), so a
    // guest can only take a free ticket
    if (guest && Number(ticketType.price) > 0) {
      return NextResponse.json({ success: false, message: "Please log in to buy a paid ticket." }, { status: 401 })
    }

    // Handle coupon (outside tx — validation only, actual increment inside tx).
    // Guests only take free tickets, so a coupon would just use up a redemption.
    let discountAmount = 0
    let couponId: string | undefined
    if (couponCode && !guest) {
      const coupon = await prisma.coupon.findFirst({
        where: {
          code: couponCode,
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now },
          OR: [{ eventId }, { eventId: null }],
        },
      })

      if (coupon) {
        if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
          return NextResponse.json({ success: false, message: "Coupon has been fully redeemed" }, { status: 400 })
        }

        const price = Number(ticketType.price) * quantity
        discountAmount = coupon.discountType === "PERCENTAGE"
          ? (price * Number(coupon.discountValue)) / 100
          : Math.min(Number(coupon.discountValue), price)

        couponId = coupon.id
      }
    }

    // Every check passed. A guest without an account gets one now (no password: signing up
    // later with this email takes it over, registration included).
    const registrantId = userId ?? (guest
      ? (await prisma.user.upsert({
          where: { email: guest.email },
          update: {},
          create: { email: guest.email, name: guest.name, role: "USER" },
          select: { id: true },
        })).id
      : null)
    if (!registrantId) {
      return NextResponse.json({ success: false, message: "Please provide your name and email, or log in to register" }, { status: 400 })
    }

    const registrationNumber = existing?.registrationNumber ?? generateRegistrationNumber()
    const amount = Math.max(0, Number(ticketType.price) * quantity - discountAmount)

    // A paid registration holds its seat while the buyer pays (released after
    // SEAT_HOLD_MINUTES if unpaid). Free registrations that need organizer approval only
    // count once approved.
    const awaitsPayment = event.isPaid && amount > 0
    const awaitsApproval = event.approvalRequired && !awaitsPayment

    // Create the registration in a transaction. Each capacity counter (event seats, ticket
    // type stock, coupon uses) is claimed with a conditional UPDATE ... WHERE <still room>
    // (see claimRegistrationCapacity), so concurrent requests can't oversell; any later
    // throw rolls the claims back with the transaction.
    const registration = await prisma.$transaction(async (tx) => {
      // Reusing an earlier registration: lock it and give back anything it still holds.
      if (existing) await takeOverRegistration(tx, existing)

      const { waitlisted, waitlistPosition } = await claimRegistrationCapacity(tx, {
        eventId,
        ticketTypeId,
        quantity,
        countsNow: !awaitsApproval,
        couponId,
      })

      // Determine status now that capacity is known
      let status: "PENDING" | "CONFIRMED" | "WAITLISTED" = "CONFIRMED"
      if (waitlisted) status = "WAITLISTED"
      else if (awaitsPayment || event.approvalRequired) status = "PENDING"
      const holdExpiresAt = status === "PENDING" && awaitsPayment ? newHoldExpiry() : null

      const fields = {
        ticketTypeId,
        status,
        type: teamId ? "TEAM" as const : "INDIVIDUAL" as const,
        teamId: teamId || null,
        formResponses: (formResponses as Prisma.InputJsonValue) || undefined,
        source: "WEBSITE",
        waitlistPosition,
        metadata: {
          ticketQuantity: quantity,
          ...(holdExpiresAt ? { holdExpiresAt } : {}),
          ...(existing ? { reregisteredAt: new Date().toISOString(), previousStatus: existing.status } : {}),
        },
      }
      const reg = existing
        ? await tx.registration.update({ where: { id: existing.id }, data: { ...fields, ...FRESH_REGISTRATION_FIELDS } })
        : await tx.registration.create({ data: { ...fields, registrationNumber, eventId, userId: registrantId } })

      // Create ticket if free + confirmed
      let ticket = null
      if (status === "CONFIRMED" && amount === 0) {
        ticket = await issueFreeTicket(tx, { registrationId: reg.id, ticketTypeId, userId: registrantId, eventId })
      }

      // Payment record if paid. A reused registration already has one (one per
      // registration): it is reset for this attempt, or closed if this one is free.
      let payment = null
      if (existing?.payment) {
        payment = await resetPaymentForReuse(
          tx,
          existing.payment,
          amount > 0 ? { amount, currency: ticketType.currency, discountAmount, couponId: couponId || null } : null
        )
      } else if (amount > 0) {
        payment = await tx.payment.create({
          data: {
            paymentNumber: `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            registrationId: reg.id,
            userId: registrantId,
            eventId,
            amount,
            currency: ticketType.currency,
            status: "PENDING",
            method: "RAZORPAY",
            discountAmount: discountAmount > 0 ? discountAmount : null,
            couponId: couponId || null,
          },
        })
      }

      return { registration: reg, ticket, payment, status, holdExpiresAt }
    })

    // A guest has no account to sign in to: their ticket gets a view-only link (token stored
    // hashed on the ticket), emailed and returned so the success screen can show and keep it.
    let ticketLink: string | null = null
    if (guest && registration.ticket) {
      try {
        ticketLink = await issueTicketViewLink(prisma, registration.ticket, event.slug)
      } catch (err) {
        console.error("Guest ticket link failed:", err)
      }
    }
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "")

    // Send confirmation email
    const emailSubject = registration.status === "CONFIRMED"
      ? `Registration Confirmed — ${event.title}`
      : registration.status === "WAITLISTED"
        ? `You're on the Waitlist — ${event.title}`
        : `Registration Received — ${event.title}`

    // Send confirmation email (to logged-in user or guest)
    const recipientEmail = session?.user?.email || guest?.email || ""
    if (recipientEmail) {
      await sendEmail({
        to: recipientEmail,
        subject: emailSubject,
        html: `<h2>${escapeHtml(emailSubject)}</h2><p>Registration #: ${registrationNumber}</p><p>Event: ${escapeHtml(event.title)}</p>` +
          (ticketLink
            ? `<p><a href="${escapeHtml(appUrl + ticketLink)}">View your ticket</a> (QR code and PDF). Keep this link private.</p>` +
              `<p>To see all your tickets, <a href="${escapeHtml(appUrl + "/forgot-password")}">set a password</a> for ${escapeHtml(recipientEmail)}.</p>`
            : ""),
      })
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: registrantId,
      action: "CREATE",
      entityType: "REGISTRATION",
      entityId: registration.registration.id,
      description: `Registered for event: ${event.title}`,
      ipAddress,
      userAgent,
      organizationId: event.organizationId || undefined,
      enterpriseId: event.enterpriseId || undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        registration: registration.registration,
        ticket: registration.ticket ? publicTicket(registration.ticket) : null,
        // guests only: the path of their view-only ticket page
        ticketLink,
        payment: registration.payment,
        registrationNumber,
        // Set while a paid registration holds its seat awaiting payment.
        holdExpiresAt: registration.holdExpiresAt,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ReuseConflict) {
      return NextResponse.json({ success: false, message: "You are already registered for this event" }, { status: 409 })
    }
    const code = capacityErrorCode(error)
    if (code) {
      return NextResponse.json({ success: false, message: CAPACITY_ERRORS[code].message }, { status: CAPACITY_ERRORS[code].status })
    }
    // A concurrent duplicate request lost the race on the (eventId, userId) unique key.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      String(error.meta?.target ?? "").includes("user")
    ) {
      return NextResponse.json({ success: false, message: "You are already registered for this event" }, { status: 409 })
    }
    console.error("Registration error:", error)
    return NextResponse.json({ success: false, message: "Registration failed. Please try again." }, { status: 500 })
  }
}

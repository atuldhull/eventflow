import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { createAuditLog, getClientInfo } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { createRegistrationSchema } from "@/lib/validations/registration"
import crypto from "crypto"

function generateRegistrationNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 99999).toString().padStart(5, "0")
  return `EVT-${year}-${random}`
}

function generateQRCode(): string {
  return `EVF-${crypto.randomUUID().slice(0, 12)}`
}

function generateTicketNumber(): string {
  return `TKT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

export async function POST(request: NextRequest) {
  const session = await auth()

  try {
    const body = await request.json()

    // Guest checkout: if not logged in, require guestEmail + guestName
    let userId = session?.user?.id
    if (!userId) {
      const { guestEmail, guestName } = body
      if (!guestEmail || !guestName) {
        return NextResponse.json({ success: false, message: "Please provide your name and email, or log in to register" }, { status: 400 })
      }
      // Find or create guest user
      let guestUser = await prisma.user.findUnique({ where: { email: guestEmail } })
      if (!guestUser) {
        guestUser = await prisma.user.create({ data: { email: guestEmail, name: guestName, role: "USER" } })
      }
      userId = guestUser.id
    }

    const parsed = createRegistrationSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { eventId, ticketTypeId, quantity, formResponses, teamId, couponCode } = parsed.data

    // Fetch event
    const event = await prisma.event.findUnique({
      where: { id: eventId },
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
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
        const userDomain = user?.email?.split("@")[1]?.toLowerCase()
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

    // Check if already registered
    const existing = await prisma.registration.findUnique({
      where: { eventId_userId: { eventId, userId: userId } },
    })
    if (existing) {
      return NextResponse.json({ success: false, message: "You are already registered for this event" }, { status: 409 })
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

    // Handle coupon (outside tx — validation only, actual increment inside tx)
    let discountAmount = 0
    let couponId: string | undefined
    if (couponCode) {
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

    const registrationNumber = generateRegistrationNumber()
    const amount = Math.max(0, Number(ticketType.price) * quantity - discountAmount)

    // Create registration in transaction (capacity + availability rechecked inside tx to avoid races)
    let isWaitlisted = false
    const registration = await prisma.$transaction(async (tx) => {
      // Re-check event capacity inside tx
      const freshEvent = await tx.event.findUnique({
        where: { id: eventId },
        select: { maxCapacity: true, currentRegistrations: true, waitlistEnabled: true },
      })
      if (!freshEvent) {
        throw new Error("EVENT_GONE")
      }
      if (freshEvent.maxCapacity && freshEvent.currentRegistrations >= freshEvent.maxCapacity) {
        if (freshEvent.waitlistEnabled) {
          isWaitlisted = true
        } else {
          throw new Error("EVENT_FULL")
        }
      }

      // Re-check ticket type availability inside tx
      const freshTicketType = await tx.ticketType.findUnique({
        where: { id: ticketTypeId },
        select: { quantity: true, sold: true },
      })
      if (!freshTicketType) {
        throw new Error("TICKET_GONE")
      }
      if (freshTicketType.quantity && freshTicketType.quantity - freshTicketType.sold < quantity) {
        throw new Error("TICKETS_SOLD_OUT")
      }

      // Re-check coupon cap inside tx
      if (couponId) {
        const freshCoupon = await tx.coupon.findUnique({
          where: { id: couponId },
          select: { maxUses: true, currentUses: true },
        })
        if (freshCoupon?.maxUses && freshCoupon.currentUses >= freshCoupon.maxUses) {
          throw new Error("COUPON_EXHAUSTED")
        }
      }

      // Determine status now that capacity is known
      let status: "PENDING" | "CONFIRMED" | "WAITLISTED" = "CONFIRMED"
      if (isWaitlisted) status = "WAITLISTED"
      else if (event.approvalRequired) status = "PENDING"
      else if (event.isPaid && Number(ticketType.price) > 0) status = "PENDING"

      const waitlistPosition = isWaitlisted
        ? freshEvent.currentRegistrations - (freshEvent.maxCapacity || 0) + 1
        : null

      const reg = await tx.registration.create({
        data: {
          registrationNumber,
          eventId,
          userId: userId,
          ticketTypeId,
          status,
          type: teamId ? "TEAM" : "INDIVIDUAL",
          teamId: teamId || null,
          formResponses: (formResponses as Prisma.InputJsonValue) || undefined,
          source: "WEBSITE",
          waitlistPosition,
        },
      })

      // Only count against capacity once the registration is confirmed or waitlisted.
      // PENDING registrations (awaiting payment or approval) will be counted on confirmation.
      if (status === "CONFIRMED" || status === "WAITLISTED") {
        await tx.event.update({
          where: { id: eventId },
          data: { currentRegistrations: { increment: 1 } },
        })
      }

      // Update ticket sold count
      await tx.ticketType.update({
        where: { id: ticketTypeId },
        data: { sold: { increment: quantity } },
      })

      // Update coupon usage
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { currentUses: { increment: 1 } },
        })
      }

      // Create ticket if free + confirmed
      let ticket = null
      if (status === "CONFIRMED" && amount === 0) {
        ticket = await tx.ticket.create({
          data: {
            ticketNumber: generateTicketNumber(),
            registrationId: reg.id,
            ticketTypeId,
            userId: userId,
            eventId,
            qrCode: generateQRCode(),
            status: "ACTIVE",
          },
        })
      }

      // Create payment record if paid
      let payment = null
      if (amount > 0) {
        payment = await tx.payment.create({
          data: {
            paymentNumber: `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            registrationId: reg.id,
            userId: userId,
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

      return { registration: reg, ticket, payment, status }
    })

    // Send confirmation email
    const emailSubject = registration.status === "CONFIRMED"
      ? `Registration Confirmed — ${event.title}`
      : registration.status === "WAITLISTED"
        ? `You're on the Waitlist — ${event.title}`
        : `Registration Received — ${event.title}`

    // Send confirmation email (to logged-in user or guest)
    const recipientEmail = session?.user?.email || body.guestEmail || ""
    if (recipientEmail) {
      await sendEmail({
        to: recipientEmail,
        subject: emailSubject,
        html: `<h2>${emailSubject}</h2><p>Registration #: ${registrationNumber}</p><p>Event: ${event.title}</p>`,
      })
    }

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: userId,
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
        ticket: registration.ticket,
        payment: registration.payment,
        registrationNumber,
      },
    }, { status: 201 })
  } catch (error) {
    const code = (error as Error)?.message
    const knownErrors: Record<string, { status: number; message: string }> = {
      EVENT_GONE: { status: 404, message: "Event no longer available" },
      EVENT_FULL: { status: 400, message: "Event is full" },
      TICKET_GONE: { status: 400, message: "Ticket type no longer available" },
      TICKETS_SOLD_OUT: { status: 400, message: "Not enough tickets available" },
      COUPON_EXHAUSTED: { status: 400, message: "Coupon has been fully redeemed" },
    }
    if (code && knownErrors[code]) {
      return NextResponse.json({ success: false, message: knownErrors[code].message }, { status: knownErrors[code].status })
    }
    console.error("Registration error:", error)
    return NextResponse.json({ success: false, message: "Registration failed. Please try again." }, { status: 500 })
  }
}

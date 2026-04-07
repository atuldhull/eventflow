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
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Please log in to register" }, { status: 401 })
  }

  try {
    const body = await request.json()
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
        organizationId: true, enterpriseId: true, termsAndConditions: true,
      },
    })

    if (!event) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
    }

    // Enforce INVITE_ONLY visibility — only org/enterprise members can register
    if (event.visibility === "INVITE_ONLY") {
      const isMember = event.organizationId ? await prisma.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: event.organizationId, isActive: true },
      }) : null
      const isEntMember = event.enterpriseId ? await prisma.enterpriseMember.findFirst({
        where: { userId: session.user.id, enterpriseId: event.enterpriseId, isActive: true },
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
      where: { eventId_userId: { eventId, userId: session.user.id } },
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

    // Check ticket availability
    if (ticketType.quantity) {
      const remaining = ticketType.quantity - ticketType.sold
      if (remaining < quantity) {
        return NextResponse.json({ success: false, message: "Not enough tickets available" }, { status: 400 })
      }
    }
    if (quantity > ticketType.maxPerUser) {
      return NextResponse.json({ success: false, message: `Maximum ${ticketType.maxPerUser} tickets per person` }, { status: 400 })
    }

    // Check capacity
    let isWaitlisted = false
    if (event.maxCapacity && event.currentRegistrations >= event.maxCapacity) {
      if (event.waitlistEnabled) {
        isWaitlisted = true
      } else {
        return NextResponse.json({ success: false, message: "Event is full" }, { status: 400 })
      }
    }

    // Handle coupon
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

    // Determine status
    let status: "PENDING" | "CONFIRMED" | "WAITLISTED" = "CONFIRMED"
    if (isWaitlisted) status = "WAITLISTED"
    else if (event.approvalRequired) status = "PENDING"
    else if (event.isPaid && Number(ticketType.price) > 0) status = "PENDING"

    const registrationNumber = generateRegistrationNumber()
    const amount = Math.max(0, Number(ticketType.price) * quantity - discountAmount)

    // Create registration in transaction
    const registration = await prisma.$transaction(async (tx) => {
      const reg = await tx.registration.create({
        data: {
          registrationNumber,
          eventId,
          userId: session.user.id,
          ticketTypeId,
          status,
          type: teamId ? "TEAM" : "INDIVIDUAL",
          teamId: teamId || null,
          formResponses: (formResponses as Prisma.InputJsonValue) || undefined,
          source: "WEBSITE",
          waitlistPosition: isWaitlisted ? event.currentRegistrations - (event.maxCapacity || 0) + 1 : null,
        },
      })

      // Update event registration count
      await tx.event.update({
        where: { id: eventId },
        data: { currentRegistrations: { increment: 1 } },
      })

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
            userId: session.user.id,
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
            userId: session.user.id,
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

      return { registration: reg, ticket, payment }
    })

    // Send confirmation email
    const emailSubject = status === "CONFIRMED"
      ? `Registration Confirmed — ${event.title}`
      : status === "WAITLISTED"
        ? `You're on the Waitlist — ${event.title}`
        : `Registration Received — ${event.title}`

    await sendEmail({
      to: session.user.email || "",
      subject: emailSubject,
      html: `<h2>${emailSubject}</h2><p>Registration #: ${registrationNumber}</p><p>Event: ${event.title}</p>`,
    })

    const { ipAddress, userAgent } = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
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
    console.error("Registration error:", error)
    return NextResponse.json({ success: false, message: "Registration failed. Please try again." }, { status: 500 })
  }
}

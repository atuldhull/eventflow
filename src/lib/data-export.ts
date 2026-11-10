import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"

/**
 * "Download my data" (DPDP Act 2023, right to access): everything EventFlow keeps about
 * one account, as plain JSON. Every field is picked explicitly, so secrets never leave by
 * accident: no password hash, two-factor secret, OTPs, sign-in tokens, ticket QR codes
 * or barcodes (they are what gets you through the door), ticket view tokens, payment
 * gateway signatures or raw gateway responses.
 */

export const EXPORT_FORMAT_VERSION = 1

/** Most recent audit entries included, where the person is the actor. */
const AUDIT_LOG_LIMIT = 1000

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function money(value: Prisma.Decimal | number | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value)
}

export function exportFileName(at = new Date()): string {
  return `eventflow-data-${at.toISOString().slice(0, 10)}.json`
}

export async function buildUserDataExport(userId: string, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, emailVerified: true, phone: true, phoneVerified: true, name: true,
      firstName: true, lastName: true, avatar: true, bio: true, role: true, isActive: true,
      lastLoginAt: true, lastLoginIp: true, collegeName: true, companyName: true, designation: true,
      city: true, state: true, country: true, dateOfBirth: true, gender: true, interests: true,
      metadata: true, twoFactorEnabled: true, createdAt: true, updatedAt: true,
      // Read only to say whether a password is set; the hash itself is never copied out.
      passwordHash: true,
      accounts: { select: { provider: true, createdAt: true } },
    },
  })
  if (!user) return null

  const event = { select: { id: true, title: true, slug: true, startDate: true, endDate: true } }

  const [
    registrations, tickets, payments, certificates, notifications, savedEvents,
    organizationMemberships, enterpriseMemberships, ownedEnterprises, eventTeamMemberships,
    feedbacks, contactMessages, auditLogs,
  ] = await Promise.all([
    prisma.registration.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        registrationNumber: true, status: true, type: true, formResponses: true, notes: true,
        approvedAt: true, rejectedAt: true, rejectionReason: true, cancelledAt: true, cancellationReason: true,
        waitlistPosition: true, source: true, createdAt: true,
        event, ticketType: { select: { name: true } },
      },
    }),
    prisma.ticket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        ticketNumber: true, status: true, seatNumber: true, validFrom: true, validUntil: true,
        transferredAt: true, createdAt: true,
        event, ticketType: { select: { name: true } }, registration: { select: { registrationNumber: true } },
      },
    }),
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        paymentNumber: true, amount: true, currency: true, status: true, method: true,
        gatewayPaymentId: true, invoiceNumber: true, receiptUrl: true, taxAmount: true, discountAmount: true,
        refundAmount: true, refundReason: true, refundedAt: true, paidAt: true, failedAt: true, createdAt: true,
        event, registration: { select: { registrationNumber: true } },
      },
    }),
    prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedDate: "desc" },
      select: {
        certificateNumber: true, type: true, title: true, recipientName: true, issuedDate: true,
        fileUrl: true, verificationCode: true, status: true, downloadedAt: true, event,
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { type: true, category: true, title: true, message: true, isRead: true, readAt: true, sentAt: true, createdAt: true },
    }),
    prisma.savedEvent.findMany({ where: { userId }, orderBy: { savedAt: "desc" }, select: { savedAt: true, event } }),
    prisma.organizationMember.findMany({
      where: { userId },
      select: { role: true, isActive: true, joinedAt: true, organization: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.enterpriseMember.findMany({
      where: { userId },
      select: { role: true, isActive: true, joinedAt: true, enterprise: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.enterprise.findMany({ where: { ownerId: userId, deletedAt: null }, select: { id: true, name: true, slug: true, createdAt: true } }),
    prisma.eventTeamMember.findMany({ where: { userId }, select: { role: true, isActive: true, createdAt: true, event } }),
    prisma.feedback.findMany({
      where: { userId },
      select: { rating: true, comment: true, responses: true, isAnonymous: true, createdAt: true, event },
    }),
    prisma.contactMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { subject: true, message: true, status: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: AUDIT_LOG_LIMIT,
      select: { action: true, entityType: true, entityId: true, description: true, ipAddress: true, createdAt: true },
    }),
  ])

  const metadata = isPlainObject(user.metadata) ? user.metadata : {}

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    profile: {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      emailVerifiedAt: user.emailVerified,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      avatar: user.avatar,
      bio: user.bio,
      role: user.role,
      collegeName: user.collegeName,
      companyName: user.companyName,
      designation: user.designation,
      city: user.city,
      state: user.state,
      country: user.country,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      interests: user.interests,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      notificationPreferences: isPlainObject(metadata.notificationPreferences) ? metadata.notificationPreferences : {},
      signInMethods: [
        ...(user.passwordHash ? ["password"] : []),
        ...user.accounts.map((a) => a.provider),
      ],
    },
    registrations: registrations.map((r) => ({
      registrationNumber: r.registrationNumber,
      status: r.status,
      type: r.type,
      event: r.event,
      ticketType: r.ticketType?.name ?? null,
      formResponses: r.formResponses,
      notes: r.notes,
      waitlistPosition: r.waitlistPosition,
      source: r.source,
      registeredAt: r.createdAt,
      approvedAt: r.approvedAt,
      rejectedAt: r.rejectedAt,
      rejectionReason: r.rejectionReason,
      cancelledAt: r.cancelledAt,
      cancellationReason: r.cancellationReason,
    })),
    tickets: tickets.map((t) => ({
      ticketNumber: t.ticketNumber,
      status: t.status,
      event: t.event,
      ticketType: t.ticketType?.name ?? null,
      registrationNumber: t.registration?.registrationNumber ?? null,
      seatNumber: t.seatNumber,
      validFrom: t.validFrom,
      validUntil: t.validUntil,
      transferredAt: t.transferredAt,
      issuedAt: t.createdAt,
    })),
    payments: payments.map((p) => ({
      paymentNumber: p.paymentNumber,
      invoiceNumber: p.invoiceNumber,
      status: p.status,
      method: p.method,
      amount: money(p.amount),
      taxAmount: money(p.taxAmount),
      discountAmount: money(p.discountAmount),
      currency: p.currency,
      gatewayPaymentId: p.gatewayPaymentId,
      receiptUrl: p.receiptUrl,
      event: p.event,
      registrationNumber: p.registration?.registrationNumber ?? null,
      paidAt: p.paidAt,
      failedAt: p.failedAt,
      refundAmount: money(p.refundAmount),
      refundReason: p.refundReason,
      refundedAt: p.refundedAt,
      createdAt: p.createdAt,
    })),
    certificates: certificates.map((c) => ({
      certificateNumber: c.certificateNumber,
      title: c.title,
      type: c.type,
      recipientName: c.recipientName,
      event: c.event,
      issuedDate: c.issuedDate,
      status: c.status,
      verificationCode: c.verificationCode,
      fileUrl: c.fileUrl,
      downloadedAt: c.downloadedAt,
    })),
    notifications: notifications.map((n) => ({
      type: n.type,
      category: n.category,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      readAt: n.readAt,
      sentAt: n.sentAt,
      createdAt: n.createdAt,
    })),
    savedEvents: savedEvents.map((s) => ({ event: s.event, savedAt: s.savedAt })),
    memberships: {
      organizations: organizationMemberships.map((m) => ({ organization: m.organization, role: m.role, isActive: m.isActive, joinedAt: m.joinedAt })),
      enterprises: enterpriseMemberships.map((m) => ({ enterprise: m.enterprise, role: m.role, isActive: m.isActive, joinedAt: m.joinedAt })),
      enterprisesOwned: ownedEnterprises.map((e) => ({ id: e.id, name: e.name, slug: e.slug, createdAt: e.createdAt })),
      eventTeams: eventTeamMemberships.map((m) => ({ event: m.event, role: m.role, isActive: m.isActive, addedAt: m.createdAt })),
    },
    feedback: feedbacks.map((f) => ({
      event: f.event, rating: f.rating, comment: f.comment, responses: f.responses, isAnonymous: f.isAnonymous, submittedAt: f.createdAt,
    })),
    contactMessages: contactMessages.map((m) => ({ subject: m.subject, message: m.message, status: m.status, sentAt: m.createdAt })),
    activityLog: auditLogs.map((a) => ({
      action: a.action, entityType: a.entityType, entityId: a.entityId, description: a.description, ipAddress: a.ipAddress, at: a.createdAt,
    })),
  }
}

export type UserDataExport = NonNullable<Awaited<ReturnType<typeof buildUserDataExport>>>

import prisma from "@/lib/prisma"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { asObject } from "@/lib/org-settings"
import { createBulkNotifications } from "@/lib/notifications"
import { isRazorpayConfigured } from "@/lib/razorpay"
import { getActivePlatformSettings } from "@/lib/platform-settings-store"

/**
 * Paid tickets can only be sold while online payments work: Razorpay keys are set and
 * Platform settings → Features → Payment processing is on. Publishing (or approving) an
 * event with a paid ticket type is refused otherwise, with this message for the
 * organizer; the buyer-side "payments are not configured" answer stays as a fallback.
 * Returns null when paid tickets can be sold.
 */
export async function paidTicketsBlocker(): Promise<string | null> {
  if (!isRazorpayConfigured()) {
    return "Online payments aren't set up on EventFlow yet, so an event with paid tickets can't be published. Make every ticket free, or save the event as a draft and publish it once payments are available."
  }
  if (!(await getActivePlatformSettings()).features.paymentProcessing) {
    return "Online payments are switched off on EventFlow right now, so an event with paid tickets can't be published. Make every ticket free, or save the event as a draft and publish it once payments are back on."
  }
  return null
}

/** Active ticket types that cost money: the ones paidTicketsBlocker applies to. */
export const PAID_TICKET_WHERE = { isActive: true, price: { gt: 0 } } as const

/**
 * Enterprise setting "Require event approval" (Enterprise.settings.requireEventApproval):
 * when on, publishing an organization's event sends it to PENDING_APPROVAL instead, and an
 * enterprise admin approves or rejects it with
 * POST /api/admin/enterprise/[enterpriseId]/events/[eventId]/approve. Someone who may
 * approve for the enterprise (EVENT_PUBLISH in the enterprise) publishes directly.
 */
export function enterpriseRequiresEventApproval(settings: unknown): boolean {
  return asObject(settings).requireEventApproval === true
}

export type PublishOutcome = { status: "PUBLISHED" | "PENDING_APPROVAL"; enterpriseId: string | null }

export async function publishOutcome(orgId: string, userId: string): Promise<PublishOutcome> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { enterpriseId: true, enterprise: { select: { settings: true } } },
  })
  const enterpriseId = org?.enterpriseId ?? null
  if (!enterpriseId || !enterpriseRequiresEventApproval(org?.enterprise?.settings)) {
    return { status: "PUBLISHED", enterpriseId }
  }
  const canApprove = (await authorize(userId, PERMISSIONS.EVENT_PUBLISH, { enterpriseId })).authorized
  return { status: canApprove ? "PUBLISHED" : "PENDING_APPROVAL", enterpriseId }
}

/** Tells the enterprise's admins and managers that an event is waiting for their approval. */
export async function notifyEventApprovers(enterpriseId: string, event: { id: string; title: string }, submittedById: string) {
  const approvers = await prisma.enterpriseMember.findMany({
    where: { enterpriseId, isActive: true, role: { in: ["ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER"] }, userId: { not: submittedById } },
    select: { userId: true },
  })
  if (approvers.length === 0) return
  await createBulkNotifications(approvers.map((a) => a.userId), {
    type: "IN_APP",
    category: "UPDATE",
    title: "Event awaiting approval",
    message: `"${event.title}" was submitted for publishing and needs your approval.`,
    eventId: event.id,
    senderId: submittedById,
  })
}

export const PENDING_APPROVAL_MESSAGE = "Submitted for approval: the event goes live once an enterprise admin approves it."

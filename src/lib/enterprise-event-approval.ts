import type { Prisma } from "@prisma/client"
import { z } from "zod/v4"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { createBulkNotifications } from "@/lib/notifications"
import { PAID_TICKET_WHERE, paidTicketsBlocker } from "@/lib/event-publishing"

/*
 * Enterprise review of events sent for approval (enterprise setting "Require event
 * approval"). Approving publishes the event; rejecting sends it back to draft with a
 * required reason, kept on the event (Event.settings.approvalDecision) so the organization
 * can read it, and sent to the event's creator and the organization's admins.
 */

export const MAX_BULK_APPROVALS = 50

export const approvalDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), reason: z.string().trim().max(500).optional() }),
  z.object({
    action: z.literal("reject"),
    reason: z.string({ error: "Give a reason for rejecting it" }).trim().min(3, "Give a reason for rejecting it (at least 3 characters)").max(500),
  }),
])

export const bulkApprovalSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1, "Pick at least one event").max(MAX_BULK_APPROVALS, `Up to ${MAX_BULK_APPROVALS} events at a time`),
})

/** Cap for the bulk approve / reject endpoint. */
export const MAX_BULK_DECISIONS = 100

const bulkEventIds = z
  .array(z.string().min(1))
  .min(1, "Pick at least one event")
  .max(MAX_BULK_DECISIONS, `Up to ${MAX_BULK_DECISIONS} events at a time`)

/**
 * Bulk approve / reject: the same reason rules as a single decision (a rejection needs one,
 * at least 3 characters), and that one reason applies to every event in the list.
 */
export const bulkDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), eventIds: bulkEventIds, reason: z.string().trim().max(500).optional() }),
  z.object({
    action: z.literal("reject"),
    eventIds: bulkEventIds,
    reason: z.string({ error: "Give a reason for rejecting them" }).trim().min(3, "Give a reason for rejecting them (at least 3 characters)").max(500),
  }),
])

/** What the organization sees about the enterprise's last decision on an event. */
export interface ApprovalDecision {
  status: "APPROVED" | "REJECTED"
  reason: string | null
  decidedAt: string
  decidedById: string
  decidedByName: string | null
}

const SETTINGS_KEY = "approvalDecision"

/** The stored decision on an event, if any (Event.settings.approvalDecision). */
export function readApprovalDecision(settings: unknown): ApprovalDecision | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null
  const d = (settings as Record<string, unknown>)[SETTINGS_KEY] as Partial<ApprovalDecision> | undefined
  if (!d || (d.status !== "APPROVED" && d.status !== "REJECTED") || typeof d.decidedAt !== "string") return null
  return {
    status: d.status,
    reason: typeof d.reason === "string" ? d.reason : null,
    decidedAt: d.decidedAt,
    decidedById: typeof d.decidedById === "string" ? d.decidedById : "",
    decidedByName: typeof d.decidedByName === "string" ? d.decidedByName : null,
  }
}

/** What the organization is shown while an event the enterprise rejected is still the draft it was sent back as. */
export interface ApprovalRejection {
  reason: string | null
  decidedAt: string
  decidedByName: string | null
}

/**
 * The enterprise's rejection of an event, while it applies: rejecting sends the event back
 * to DRAFT; once it is resubmitted (PENDING_APPROVAL) or published, the notice is gone. A
 * decision older than the event itself came along with copied settings (Duplicate,
 * recurrences) and isn't about this event.
 */
export function approvalRejection(event: { status: string; settings: unknown; createdAt: Date }): ApprovalRejection | null {
  if (event.status !== "DRAFT") return null
  const decision = readApprovalDecision(event.settings)
  if (decision?.status !== "REJECTED") return null
  if (new Date(decision.decidedAt).getTime() < event.createdAt.getTime()) return null
  return { reason: decision.reason, decidedAt: decision.decidedAt, decidedByName: decision.decidedByName }
}

export type DecisionResult =
  | { ok: true; title: string; action: "approve" | "reject" }
  | { ok: false; status: 404 | 409; message: string }

/**
 * Approve or reject one PENDING_APPROVAL event of this enterprise (its own or one of its
 * organizations'). The status check is part of the update's where clause, so two
 * reviewers can't both decide the same event.
 */
export async function decideEventApproval(opts: {
  enterpriseId: string
  eventId: string
  action: "approve" | "reject"
  reason?: string
  actor: { id: string; name?: string | null }
  ipAddress?: string
  userAgent?: string
}): Promise<DecisionResult> {
  const { enterpriseId, eventId, action, actor } = opts
  const reason = opts.reason?.trim() || null
  const scope: Prisma.EventWhereInput = {
    id: eventId,
    deletedAt: null,
    status: "PENDING_APPROVAL",
    OR: [{ enterpriseId }, { organization: { enterpriseId } }],
  }

  const event = await prisma.event.findFirst({
    where: scope,
    select: { id: true, title: true, slug: true, organizationId: true, createdById: true, settings: true },
  })
  if (!event) return { ok: false, status: 404, message: "Event not found or not pending approval" }

  // Approving publishes it: paid tickets need payments to be on and configured, the same
  // rule as publishing from the organization (the reason is shown to the reviewer)
  if (action === "approve" && (await prisma.ticketType.count({ where: { eventId: event.id, ...PAID_TICKET_WHERE } })) > 0) {
    const blocker = await paidTicketsBlocker()
    if (blocker) return { ok: false, status: 409, message: blocker }
  }

  const decision: ApprovalDecision = {
    status: action === "approve" ? "APPROVED" : "REJECTED",
    reason,
    decidedAt: new Date().toISOString(),
    decidedById: actor.id,
    decidedByName: actor.name ?? null,
  }
  const settings = {
    ...(event.settings && typeof event.settings === "object" && !Array.isArray(event.settings) ? (event.settings as Record<string, unknown>) : {}),
    [SETTINGS_KEY]: decision,
  } as unknown as Prisma.InputJsonObject

  const updated = await prisma.event.updateMany({
    where: { id: event.id, status: "PENDING_APPROVAL" },
    data: action === "approve"
      ? { status: "PUBLISHED", publishedAt: new Date(), settings }
      : { status: "DRAFT", settings },
  })
  if (updated.count === 0) return { ok: false, status: 404, message: "Event not found or not pending approval" }

  // The creator and the organization's admins hear about it (once each)
  const orgAdmins = event.organizationId
    ? await prisma.organizationMember.findMany({
        where: { organizationId: event.organizationId, isActive: true, role: "ORG_ADMIN" },
        select: { userId: true },
      })
    : []
  const recipients = Array.from(new Set([event.createdById, ...orgAdmins.map((m) => m.userId)].filter((id) => id && id !== actor.id)))
  if (recipients.length > 0) {
    await createBulkNotifications(recipients, {
      type: "IN_APP",
      category: "UPDATE",
      title: action === "approve" ? "Event approved" : "Event not approved",
      message: action === "approve"
        ? `"${event.title}" was approved and is now published.`
        : `"${event.title}" was sent back to draft. Reason: ${reason}`,
      eventId: event.id,
      senderId: actor.id,
      data: { kind: "event-approval", decision: decision.status, reason: reason ?? "", eventId: event.id, eventSlug: event.slug },
    })
  }

  await createAuditLog({
    userId: actor.id,
    action: action === "approve" ? "APPROVE" : "REJECT",
    entityType: "EVENT",
    entityId: event.id,
    description: `${action === "approve" ? "Approved" : "Rejected"} event: ${event.title}${reason ? ` — ${reason}` : ""}`,
    newValues: { status: action === "approve" ? "PUBLISHED" : "DRAFT", reason },
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    enterpriseId,
    organizationId: event.organizationId || undefined,
    eventId: event.id,
  })

  return { ok: true, title: event.title, action }
}

export interface BulkDecisionResult {
  id: string
  ok: boolean
  message: string
}

/**
 * Approve or reject several events one at a time through decideEventApproval, so each gets
 * exactly the single-event treatment (enterprise scope, status check, paid-ticket rule,
 * notifications, audit log). Duplicate ids are decided once. One event failing (another
 * enterprise's, no longer pending, can't be published, an unexpected error) doesn't stop
 * the rest: every id gets its own result, in the order given.
 */
export async function decideEventApprovals(opts: {
  enterpriseId: string
  eventIds: string[]
  action: "approve" | "reject"
  reason?: string
  actor: { id: string; name?: string | null }
  ipAddress?: string
  userAgent?: string
}): Promise<BulkDecisionResult[]> {
  const { eventIds, ...rest } = opts
  const results: BulkDecisionResult[] = []
  for (const id of Array.from(new Set(eventIds))) {
    try {
      const r = await decideEventApproval({ ...rest, eventId: id })
      results.push(
        r.ok
          ? { id, ok: true, message: r.action === "approve" ? `${r.title} is published` : `${r.title} was sent back to draft` }
          : { id, ok: false, message: r.message }
      )
    } catch (error) {
      console.error("Bulk event decision failed for", id, error)
      results.push({ id, ok: false, message: "Something went wrong" })
    }
  }
  return results
}

/** "Approved 4 of 5 — 1 failed: <reason>", for the reviewer's toast. */
export function summarizeBulkDecision(action: "approve" | "reject", results: BulkDecisionResult[]): string {
  const done = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  const head = `${action === "approve" ? "Approved" : "Rejected"} ${done} of ${results.length}`
  if (failed.length === 0) return head
  const reasons = Array.from(new Set(failed.map((f) => f.message)))
  return `${head} — ${failed.length} failed: ${reasons.slice(0, 2).join("; ")}${reasons.length > 2 ? "…" : ""}`
}

import { z } from "zod/v4"
import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { asObject, updateOrgSettings, type OrgSettings } from "@/lib/org-settings"

/**
 * Email campaigns to an organization's participants: who receives them, and the drafts
 * saved from the composer. There is no Communication table, so drafts live in
 * Organization.settings.communicationDrafts (newest first, capped) and the history of
 * sent emails is the organization's COMMUNICATION audit entries.
 */

export const REGISTRATION_STATUSES = [
  "PENDING", "CONFIRMED", "WAITLISTED", "REJECTED", "CANCELLED", "CHECKED_IN", "NO_SHOW",
] as const

export const recipientFilterSchema = z
  .object({
    type: z.enum(["all", "by_event", "by_status", "custom"]),
    eventId: z.string().min(1).max(50).optional(),
    statuses: z.array(z.enum(REGISTRATION_STATUSES)).max(REGISTRATION_STATUSES.length).optional(),
    userIds: z.array(z.string().min(1).max(50)).max(5000).optional(),
  })
  .refine((f) => f.type !== "by_event" || !!f.eventId, { message: "Choose an event", path: ["eventId"] })
  .refine((f) => f.type !== "by_status" || (f.statuses?.length ?? 0) > 0, { message: "Choose at least one status", path: ["statuses"] })

export type RecipientFilter = z.infer<typeof recipientFilterSchema>

// people who cancelled or were turned down aren't "participants" unless asked for by status
const DEFAULT_STATUSES = ["PENDING", "CONFIRMED", "WAITLISTED", "CHECKED_IN", "NO_SHOW"] as const

/**
 * The people an email goes to, one per address. Every query is scoped to this
 * organization's events: an event id from another organization simply matches nobody.
 * Used by Send and by the recipient count shown before sending, so both agree.
 */
export async function resolveRecipients(orgId: string, recipientFilter: RecipientFilter, eventId?: string) {
  const where: Prisma.RegistrationWhereInput = { event: { organizationId: orgId, deletedAt: null } }
  if (recipientFilter.type === "custom") {
    where.userId = { in: recipientFilter.userIds ?? [] }
  } else {
    if (eventId) where.eventId = eventId
    where.status = { in: recipientFilter.statuses?.length ? recipientFilter.statuses : [...DEFAULT_STATUSES] }
  }

  const registrations = await prisma.registration.findMany({
    where,
    select: {
      userId: true,
      registrationNumber: true,
      user: { select: { name: true, email: true } },
      event: { select: { title: true } },
    },
  })

  // Deduplicate by email
  const seen = new Set<string>()
  const recipients = registrations.filter((r) => {
    if (seen.has(r.user.email)) return false
    seen.add(r.user.email)
    return true
  })
  return { registrations: registrations.length, recipients }
}

export const COMMUNICATION_ENTITY = "COMMUNICATION"

const DRAFTS_KEY = "communicationDrafts"
const MAX_DRAFTS = 50

export const draftInputSchema = z.object({
  id: z.string().regex(/^d_[a-z0-9]{6,32}$/).optional(),
  subject: z.string().trim().max(150).default(""),
  body: z.string().max(20_000).default(""),
  // Left out while the author hasn't chosen recipients yet: a draft never defaults to everyone.
  recipientFilter: z
    .object({
      type: z.enum(["all", "by_event", "by_status"]),
      eventId: z.string().max(50).optional(),
      statuses: z.array(z.enum(REGISTRATION_STATUSES)).optional(),
    })
    .optional(),
})
  .refine((d) => d.subject.length > 0 || d.body.trim().length > 0, { message: "Write a subject or a message first" })

const storedDraftSchema = z.object({
  id: z.string(),
  subject: z.string(),
  body: z.string(),
  recipientFilter: z.object({
    type: z.enum(["all", "by_event", "by_status"]),
    eventId: z.string().optional(),
    statuses: z.array(z.string()).optional(),
  }).optional(),
  updatedAt: z.string(),
  updatedById: z.string().optional(),
  updatedByName: z.string().optional(),
})

export type CommunicationDraft = z.infer<typeof storedDraftSchema>

export function readDrafts(settings: OrgSettings | null | undefined): CommunicationDraft[] {
  const list = asObject(settings)[DRAFTS_KEY]
  if (!Array.isArray(list)) return []
  return list.flatMap((item) => {
    const parsed = storedDraftSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

function newDraftId() {
  return `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** Creates a draft, or replaces the one with the same id; returns the saved draft. */
export async function saveDraft(
  orgId: string,
  input: z.infer<typeof draftInputSchema>,
  author: { id: string; name?: string | null }
): Promise<CommunicationDraft | null> {
  const draft: CommunicationDraft = {
    id: input.id ?? newDraftId(),
    subject: input.subject,
    body: input.body,
    recipientFilter: input.recipientFilter,
    updatedAt: new Date().toISOString(),
    updatedById: author.id,
    updatedByName: author.name ?? undefined,
  }
  const saved = await updateOrgSettings(orgId, (current) => ({
    [DRAFTS_KEY]: [draft, ...readDrafts(current).filter((d) => d.id !== draft.id)].slice(0, MAX_DRAFTS),
  }))
  return saved ? draft : null
}

/** Deletes a draft; returns whether it existed. */
export async function deleteDraft(orgId: string, draftId: string): Promise<boolean> {
  let found = false
  await updateOrgSettings(orgId, (current) => {
    const list = readDrafts(current)
    found = list.some((d) => d.id === draftId)
    return found ? { [DRAFTS_KEY]: list.filter((d) => d.id !== draftId) } : {}
  })
  return found
}

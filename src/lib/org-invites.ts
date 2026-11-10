import { z } from "zod/v4"
import prisma from "@/lib/prisma"
import { asObject, updateOrgSettings, type OrgSettings } from "@/lib/org-settings"
import { createNotification } from "@/lib/notifications"
import { createAuditLog } from "@/lib/audit"

/**
 * Invitations to people who don't have an EventFlow account yet. There is no invitation
 * table, so they live in Organization.settings.pendingInvites. Inviting someone who has
 * an account adds them straight away. Someone who signs up with an invited address gets
 * the membership when the address is verified (or on their next sign-in): see
 * acceptPendingInvites.
 */

const KEY = "pendingInvites"
const MAX_PENDING = 200

const pendingInviteSchema = z.object({
  email: z.string(),
  role: z.string(),
  invitedAt: z.string(),
  invitedById: z.string().optional(),
  invitedByName: z.string().optional(),
})

export type PendingInvite = z.infer<typeof pendingInviteSchema>

export function readPendingInvites(settings: OrgSettings | null | undefined): PendingInvite[] {
  const list = asObject(settings)[KEY]
  if (!Array.isArray(list)) return []
  return list.flatMap((item) => {
    const parsed = pendingInviteSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

/** Records (or refreshes) a pending invitation; the newest invitation per email wins. */
export async function addPendingInvite(orgId: string, invite: PendingInvite) {
  const email = invite.email.toLowerCase()
  await updateOrgSettings(orgId, (current) => ({
    [KEY]: [{ ...invite, email }, ...readPendingInvites(current).filter((i) => i.email !== email)].slice(0, MAX_PENDING),
  }))
}

/** Drops the pending invitation for `email`; returns the one removed, if any. */
export async function removePendingInvite(orgId: string, email: string): Promise<PendingInvite | null> {
  const target = email.toLowerCase()
  let removed: PendingInvite | null = null
  await updateOrgSettings(orgId, (current) => {
    const list = readPendingInvites(current)
    removed = list.find((i) => i.email === target) ?? null
    return { [KEY]: list.filter((i) => i.email !== target) }
  })
  return removed
}

/** Roles an organization invitation can carry (what POST /api/members/invite accepts). */
export const INVITABLE_ROLES = [
  "ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER", "ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER",
] as const
type InvitableRole = (typeof INVITABLE_ROLES)[number]

const ACCEPTED_KEY = "acceptedInvites"
const MAX_ACCEPTED = 200

export interface AcceptedInvite {
  organizationId: string
  organizationName: string
  role: InvitableRole
  invitedById?: string
  /** false when the person was already an active member (their role is kept) */
  joined: boolean
}

/**
 * Turns every pending invitation for `user.email` into a membership, once the address is
 * verified: the membership gets the invited role (a removed one is brought back; an active
 * one keeps its role), the invitation moves from pendingInvites to acceptedInvites, and the
 * new member and the inviter are notified. Each organization is handled under its row
 * lock and the invitation is removed in the same transaction as the membership write, so
 * an invitation is accepted exactly once even if sign-in and verification race.
 * Organizations that are deactivated or deleted keep the invitation pending.
 */
export async function acceptPendingInvites(user: { id: string; email: string; name?: string | null }): Promise<AcceptedInvite[]> {
  const email = user.email.trim().toLowerCase()
  const candidates = await prisma.organization.findMany({
    where: { deletedAt: null, isActive: true, settings: { path: [KEY], array_contains: [{ email }] } },
    select: { id: true },
  })

  const accepted: AcceptedInvite[] = []
  for (const { id: orgId } of candidates) {
    let result = null as AcceptedInvite | null
    await updateOrgSettings(orgId, async (current, tx) => {
      const pending = readPendingInvites(current)
      const invite = pending.find((i) => i.email === email)
      if (!invite || !(INVITABLE_ROLES as readonly string[]).includes(invite.role)) return {}

      const org = await tx.organization.findUnique({ where: { id: orgId }, select: { name: true, isActive: true, deletedAt: true } })
      if (!org || !org.isActive || org.deletedAt) return {}

      const role = invite.role as InvitableRole
      const existing = await tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
        select: { id: true, isActive: true },
      })
      const wasActiveMember = existing?.isActive === true
      if (!existing) {
        await tx.organizationMember.create({
          data: { organizationId: orgId, userId: user.id, role, invitedBy: invite.invitedById, isActive: true, joinedAt: new Date() },
        })
      } else if (!existing.isActive) {
        await tx.organizationMember.update({
          where: { id: existing.id },
          data: { role, invitedBy: invite.invitedById, isActive: true, joinedAt: new Date() },
        })
      }

      result = { organizationId: orgId, organizationName: org.name, role, invitedById: invite.invitedById, joined: !wasActiveMember }
      const history = Array.isArray(current[ACCEPTED_KEY]) ? (current[ACCEPTED_KEY] as unknown[]) : []
      return {
        [KEY]: pending.filter((i) => i.email !== email),
        [ACCEPTED_KEY]: [{ ...invite, acceptedAt: new Date().toISOString(), userId: user.id }, ...history].slice(0, MAX_ACCEPTED),
      }
    })
    if (result) accepted.push(result)
  }

  for (const invite of accepted) {
    const roleLabel = invite.role.replace(/_/g, " ").toLowerCase()
    if (invite.joined) {
      await createNotification({
        userId: user.id,
        type: "IN_APP",
        category: "SYSTEM",
        title: `You've joined ${invite.organizationName}`,
        message: `Your invitation was accepted: you're now a member of ${invite.organizationName} (${roleLabel}).`,
        senderId: invite.invitedById,
      })
    }
    if (invite.invitedById && invite.invitedById !== user.id) {
      await createNotification({
        userId: invite.invitedById,
        type: "IN_APP",
        category: "SYSTEM",
        title: "Invitation accepted",
        message: `${user.name || email} joined ${invite.organizationName} as ${roleLabel}.`,
        senderId: user.id,
      })
    }
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "ORGANIZATION",
      entityId: invite.organizationId,
      description: `${email} accepted the invitation as ${invite.role}`,
      newValues: { email, role: invite.role },
      organizationId: invite.organizationId,
    })
  }
  return accepted
}

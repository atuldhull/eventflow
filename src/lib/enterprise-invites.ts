import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { asObject } from "@/lib/org-settings"
import { readPendingInvites, type PendingInvite } from "@/lib/org-invites"
import { createNotification } from "@/lib/notifications"
import { createAuditLog } from "@/lib/audit"

/**
 * Enterprise invitations to people who don't have an EventFlow account yet, kept the same
 * way as organization ones (src/lib/org-invites.ts): there is no invitation table, so they
 * live in Enterprise.settings.pendingInvites. Someone who signs up with an invited address
 * gets the membership when the address is verified (or on their next sign-in): see
 * acceptEnterprisePendingInvites.
 */

const KEY = "pendingInvites"
const ACCEPTED_KEY = "acceptedInvites"
const MAX_PENDING = 200
const MAX_ACCEPTED = 200

/** Roles an enterprise invitation can carry (what POST /api/members/invite accepts). */
export const ENTERPRISE_INVITABLE_ROLES = [
  "ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER", "ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER",
] as const
type InvitableRole = (typeof ENTERPRISE_INVITABLE_ROLES)[number]

export type EnterpriseSettings = Record<string, unknown>

export async function readEnterpriseSettings(enterpriseId: string): Promise<EnterpriseSettings | null> {
  const enterprise = await prisma.enterprise.findFirst({ where: { id: enterpriseId, deletedAt: null }, select: { settings: true } })
  return enterprise ? asObject(enterprise.settings) : null
}

/** The enterprise's pending invitations (newest first). */
export function readEnterprisePendingInvites(settings: EnterpriseSettings | null | undefined): PendingInvite[] {
  return readPendingInvites(settings)
}

/**
 * Locks the enterprise row, hands `change` the current settings, and merges the top-level
 * keys it returns into the stored object (other keys, e.g. the enterprise rules, are kept).
 * Returns null when the enterprise doesn't exist. `change` gets the transaction, so a
 * related write (the membership) commits or rolls back with the settings.
 */
export async function updateEnterpriseSettings(
  enterpriseId: string,
  change: (current: EnterpriseSettings, tx: Prisma.TransactionClient) => EnterpriseSettings | Promise<EnterpriseSettings>
): Promise<EnterpriseSettings | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ settings: unknown }[]>`
      SELECT settings FROM enterprises WHERE id = ${enterpriseId} FOR UPDATE`
    if (rows.length === 0) return null
    const current = asObject(rows[0].settings)
    const patch = await change(current, tx)
    if (Object.keys(patch).length === 0) return current
    await tx.$executeRaw`
      UPDATE enterprises
      SET settings = (CASE WHEN jsonb_typeof(settings) = 'object' THEN settings ELSE '{}'::jsonb END)
                     || ${JSON.stringify(patch)}::jsonb,
          updated_at = NOW()
      WHERE id = ${enterpriseId}`
    return { ...current, ...patch }
  })
}

/** Records (or refreshes) a pending invitation; the newest invitation per email wins. */
export async function addEnterprisePendingInvite(enterpriseId: string, invite: PendingInvite) {
  const email = invite.email.toLowerCase()
  await updateEnterpriseSettings(enterpriseId, (current) => ({
    [KEY]: [{ ...invite, email }, ...readPendingInvites(current).filter((i) => i.email !== email)].slice(0, MAX_PENDING),
  }))
}

/** Drops the pending invitation for `email`; returns the one removed, if any. */
export async function removeEnterprisePendingInvite(enterpriseId: string, email: string): Promise<PendingInvite | null> {
  const target = email.toLowerCase()
  let removed: PendingInvite | null = null
  await updateEnterpriseSettings(enterpriseId, (current) => {
    const list = readPendingInvites(current)
    removed = list.find((i) => i.email === target) ?? null
    return removed ? { [KEY]: list.filter((i) => i.email !== target) } : {}
  })
  return removed
}

export interface AcceptedEnterpriseInvite {
  enterpriseId: string
  enterpriseName: string
  role: InvitableRole
  invitedById?: string
  /** false when the person was already an active member (their role is kept) */
  joined: boolean
}

/**
 * Turns every pending enterprise invitation for `user.email` into a membership once the
 * address is verified: the membership gets the invited role (a removed one is brought
 * back; an active one keeps its role), the invitation moves to acceptedInvites, and the new
 * member and the inviter are notified. Each enterprise is handled under its row lock, so
 * an invitation is accepted exactly once. Deactivated or deleted enterprises keep theirs.
 */
export async function acceptEnterprisePendingInvites(user: { id: string; email: string; name?: string | null }): Promise<AcceptedEnterpriseInvite[]> {
  const email = user.email.trim().toLowerCase()
  const candidates = await prisma.enterprise.findMany({
    where: { deletedAt: null, isActive: true, settings: { path: [KEY], array_contains: [{ email }] } },
    select: { id: true },
  })

  const accepted: AcceptedEnterpriseInvite[] = []
  for (const { id: enterpriseId } of candidates) {
    let result = null as AcceptedEnterpriseInvite | null
    await updateEnterpriseSettings(enterpriseId, async (current, tx) => {
      const pending = readPendingInvites(current)
      const invite = pending.find((i) => i.email === email)
      if (!invite || !(ENTERPRISE_INVITABLE_ROLES as readonly string[]).includes(invite.role)) return {}

      const enterprise = await tx.enterprise.findUnique({ where: { id: enterpriseId }, select: { name: true, isActive: true, deletedAt: true } })
      if (!enterprise || !enterprise.isActive || enterprise.deletedAt) return {}

      const role = invite.role as InvitableRole
      const existing = await tx.enterpriseMember.findUnique({
        where: { enterpriseId_userId: { enterpriseId, userId: user.id } },
        select: { id: true, isActive: true },
      })
      const wasActiveMember = existing?.isActive === true
      if (!existing) {
        await tx.enterpriseMember.create({
          data: { enterpriseId, userId: user.id, role, invitedBy: invite.invitedById, isActive: true, joinedAt: new Date() },
        })
      } else if (!existing.isActive) {
        await tx.enterpriseMember.update({
          where: { id: existing.id },
          data: { role, invitedBy: invite.invitedById, isActive: true, joinedAt: new Date() },
        })
      }

      result = { enterpriseId, enterpriseName: enterprise.name, role, invitedById: invite.invitedById, joined: !wasActiveMember }
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
        title: `You've joined ${invite.enterpriseName}`,
        message: `Your invitation was accepted: you're now a member of ${invite.enterpriseName} (${roleLabel}).`,
        senderId: invite.invitedById,
      })
    }
    if (invite.invitedById && invite.invitedById !== user.id) {
      await createNotification({
        userId: invite.invitedById,
        type: "IN_APP",
        category: "SYSTEM",
        title: "Invitation accepted",
        message: `${user.name || email} joined ${invite.enterpriseName} as ${roleLabel}.`,
        senderId: user.id,
      })
    }
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "ENTERPRISE",
      entityId: invite.enterpriseId,
      description: `${email} accepted the invitation as ${invite.role}`,
      newValues: { email, role: invite.role },
      enterpriseId: invite.enterpriseId,
    })
  }
  return accepted
}

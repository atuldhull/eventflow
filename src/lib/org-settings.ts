import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"

/**
 * Organization.settings is one JSON object shared by several features (org preferences,
 * communication drafts, pending invitations). Each writer changes only its own top-level
 * keys, under a row lock, so two features saving at the same time can't overwrite each
 * other's data.
 */

export type OrgSettings = Record<string, unknown>

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export async function readOrgSettings(orgId: string): Promise<OrgSettings | null> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } })
  return org ? asObject(org.settings) : null
}

/**
 * Locks the organization row, hands `change` the current settings, and merges the
 * top-level keys it returns into the stored object (other keys are kept as they are).
 * Returns null when the organization doesn't exist. `change` may be async and gets the
 * transaction, so related writes (e.g. a membership) commit or roll back with the settings.
 */
export async function updateOrgSettings(
  orgId: string,
  change: (current: OrgSettings, tx: Prisma.TransactionClient) => OrgSettings | Promise<OrgSettings>
): Promise<OrgSettings | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ settings: unknown }[]>`
      SELECT settings FROM organizations WHERE id = ${orgId} FOR UPDATE`
    if (rows.length === 0) return null
    const current = asObject(rows[0].settings)
    const patch = await change(current, tx)
    await tx.$executeRaw`
      UPDATE organizations
      SET settings = (CASE WHEN jsonb_typeof(settings) = 'object' THEN settings ELSE '{}'::jsonb END)
                     || ${JSON.stringify(patch)}::jsonb,
          updated_at = NOW()
      WHERE id = ${orgId}`
    return { ...current, ...patch }
  })
}

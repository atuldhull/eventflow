import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"
import { clearTenantCache } from "@/lib/tenant"
import { confirmationMatches, type SuperAdminEnterpriseCreate } from "@/lib/enterprise-admin"

export type DeleteEnterpriseResult =
  | { ok: true; name: string }
  | { ok: false; status: 400 | 404; message: string }

/**
 * Soft-delete an enterprise: it is hidden (deletedAt) and switched off (isActive), and its
 * custom domain is released. Organizations, events and history are left intact so the
 * enterprise can be restored. `confirm` must be the enterprise's name or slug.
 */
export async function softDeleteEnterprise(opts: {
  enterpriseId: string
  actorId: string
  confirm: unknown
  ipAddress?: string
  userAgent?: string
  via: "super-admin" | "enterprise-owner"
}): Promise<DeleteEnterpriseResult> {
  const enterprise = await prisma.enterprise.findFirst({
    where: { id: opts.enterpriseId, deletedAt: null },
    select: { id: true, name: true, slug: true, customDomain: true, isActive: true },
  })
  if (!enterprise) return { ok: false, status: 404, message: "Enterprise not found" }

  if (!confirmationMatches(opts.confirm, enterprise)) {
    return { ok: false, status: 400, message: `Type the enterprise name "${enterprise.name}" to confirm.` }
  }

  await prisma.enterprise.update({
    where: { id: enterprise.id },
    data: { deletedAt: new Date(), isActive: false, customDomain: null },
  })
  if (enterprise.customDomain) clearTenantCache(enterprise.customDomain)

  await createAuditLog({
    userId: opts.actorId,
    action: "DELETE",
    entityType: "ENTERPRISE",
    entityId: enterprise.id,
    description: `Deleted enterprise: ${enterprise.name} (${opts.via})`,
    oldValues: { isActive: enterprise.isActive, customDomain: enterprise.customDomain, deletedAt: null },
    newValues: { isActive: false, customDomain: null, deleted: true },
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    enterpriseId: enterprise.id,
  })

  return { ok: true, name: enterprise.name }
}

type Failure = { ok: false; status: 400 | 404 | 409; message: string; field?: string }

/** An account that can hold a role: exists, active, not banned, not deleted. */
async function activeAccountByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true, isBanned: true, deletedAt: true },
  })
  if (!user || user.deletedAt) return { user: null, reason: `No EventFlow account uses ${email}. They need to sign up first.` }
  if (!user.isActive || user.isBanned) return { user: null, reason: `The account for ${email} is suspended or banned.` }
  return { user, reason: null }
}

/**
 * Create an enterprise for an existing account (super admin). The enterprise and the
 * owner's ENTERPRISE_ADMIN membership are written together (one nested create), so the
 * owner can open it straight away. Slugs are unique across every enterprise ever created:
 * a deleted enterprise keeps its slug (it can be restored), so reusing one is refused.
 */
export async function createEnterpriseWithOwner(
  input: SuperAdminEnterpriseCreate,
  actor: { id: string; ipAddress?: string; userAgent?: string }
): Promise<{ ok: true; enterprise: { id: string; name: string; slug: string }; owner: { id: string; name: string; email: string } } | Failure> {
  const { user: owner, reason } = await activeAccountByEmail(input.ownerEmail)
  if (!owner) return { ok: false, status: 400, message: reason ?? "Unknown owner", field: "ownerEmail" }

  const taken = await prisma.enterprise.findUnique({ where: { slug: input.slug }, select: { deletedAt: true } })
  if (taken) {
    return {
      ok: false,
      status: 409,
      field: "slug",
      message: taken.deletedAt
        ? `The slug "${input.slug}" belonged to a deleted enterprise and can't be reused. Choose another.`
        : `The slug "${input.slug}" is already in use. Choose another.`,
    }
  }

  let enterprise: { id: string; name: string; slug: string }
  try {
    enterprise = await prisma.enterprise.create({
      data: {
        name: input.name,
        slug: input.slug,
        email: input.email,
        type: input.type ?? null,
        description: input.description ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        ownerId: owner.id,
        members: {
          create: { userId: owner.id, role: "ENTERPRISE_ADMIN", isActive: true, invitedBy: actor.id, joinedAt: new Date() },
        },
      },
      select: { id: true, name: true, slug: true },
    })
  } catch (error) {
    // two requests raced past the check above
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, status: 409, field: "slug", message: `The slug "${input.slug}" is already in use. Choose another.` }
    }
    throw error
  }

  await createAuditLog({
    userId: actor.id,
    action: "CREATE",
    entityType: "ENTERPRISE",
    entityId: enterprise.id,
    description: `Created enterprise: ${enterprise.name}, owned by ${owner.email}`,
    newValues: { name: enterprise.name, slug: enterprise.slug, ownerId: owner.id, ownerEmail: owner.email },
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    enterpriseId: enterprise.id,
  })
  if (owner.id !== actor.id) {
    await createNotification({
      userId: owner.id,
      type: "IN_APP",
      category: "SYSTEM",
      title: `You own ${enterprise.name}`,
      message: `An EventFlow admin created the enterprise ${enterprise.name} with you as its owner and enterprise admin.`,
      senderId: actor.id,
    })
  }

  return { ok: true, enterprise, owner: { id: owner.id, name: owner.name, email: owner.email } }
}

/**
 * Hand an enterprise to another existing account (its owner or a super admin does this).
 * `confirm` must be the enterprise's name or slug. The new owner gets an active
 * ENTERPRISE_ADMIN membership in the same transaction as the owner change; the previous
 * owner keeps their membership (now a co-admin the new owner can manage).
 */
export async function transferEnterpriseOwnership(opts: {
  enterpriseId: string
  actorId: string
  newOwnerEmail: string
  confirm: unknown
  ipAddress?: string
  userAgent?: string
}): Promise<{ ok: true; name: string; newOwner: { id: string; name: string; email: string } } | Failure> {
  const enterprise = await prisma.enterprise.findFirst({
    where: { id: opts.enterpriseId, deletedAt: null },
    select: { id: true, name: true, slug: true, ownerId: true, owner: { select: { email: true } } },
  })
  if (!enterprise) return { ok: false, status: 404, message: "Enterprise not found" }

  if (!confirmationMatches(opts.confirm, enterprise)) {
    return { ok: false, status: 400, field: "confirm", message: `Type the enterprise name "${enterprise.name}" to confirm.` }
  }

  const { user: newOwner, reason } = await activeAccountByEmail(opts.newOwnerEmail)
  if (!newOwner) return { ok: false, status: 400, field: "newOwnerEmail", message: reason ?? "Unknown account" }
  if (newOwner.id === enterprise.ownerId) {
    return { ok: false, status: 409, field: "newOwnerEmail", message: `${newOwner.email} already owns ${enterprise.name}.` }
  }

  await prisma.$transaction([
    prisma.enterprise.update({ where: { id: enterprise.id }, data: { ownerId: newOwner.id } }),
    prisma.enterpriseMember.upsert({
      where: { enterpriseId_userId: { enterpriseId: enterprise.id, userId: newOwner.id } },
      create: { enterpriseId: enterprise.id, userId: newOwner.id, role: "ENTERPRISE_ADMIN", isActive: true, invitedBy: opts.actorId, joinedAt: new Date() },
      update: { role: "ENTERPRISE_ADMIN", isActive: true },
    }),
  ])

  await createAuditLog({
    userId: opts.actorId,
    action: "UPDATE",
    entityType: "ENTERPRISE",
    entityId: enterprise.id,
    description: `Transferred ownership of ${enterprise.name} from ${enterprise.owner.email} to ${newOwner.email}`,
    oldValues: { ownerId: enterprise.ownerId, ownerEmail: enterprise.owner.email },
    newValues: { ownerId: newOwner.id, ownerEmail: newOwner.email },
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    enterpriseId: enterprise.id,
  })
  await createNotification({
    userId: newOwner.id,
    type: "IN_APP",
    category: "SYSTEM",
    title: `You now own ${enterprise.name}`,
    message: `Ownership of ${enterprise.name} was transferred to you. You're its owner and an enterprise admin.`,
    senderId: opts.actorId,
  })

  return { ok: true, name: enterprise.name, newOwner: { id: newOwner.id, name: newOwner.name, email: newOwner.email } }
}

/**
 * Activate or deactivate an enterprise (super admin). Deactivating switches off every
 * member's access and hides its events from the public site, so it needs the enterprise's
 * name (or slug) typed as `confirm`; activating does not.
 */
export async function setEnterpriseActive(opts: {
  enterpriseId: string
  actorId: string
  isActive?: boolean
  confirm?: unknown
  ipAddress?: string
  userAgent?: string
}): Promise<{ ok: true; enterprise: { id: string; name: string; isActive: boolean } } | Failure> {
  const enterprise = await prisma.enterprise.findFirst({
    where: { id: opts.enterpriseId, deletedAt: null },
    select: { id: true, name: true, slug: true, isActive: true, customDomain: true },
  })
  if (!enterprise) return { ok: false, status: 404, message: "Enterprise not found" }

  const next = opts.isActive ?? !enterprise.isActive
  if (next === enterprise.isActive) {
    return { ok: true, enterprise: { id: enterprise.id, name: enterprise.name, isActive: next } }
  }
  if (!next && !confirmationMatches(opts.confirm, enterprise)) {
    return { ok: false, status: 400, field: "confirm", message: `Type the enterprise name "${enterprise.name}" to deactivate it.` }
  }

  await prisma.enterprise.update({ where: { id: enterprise.id }, data: { isActive: next } })
  // its tenant site (custom domain or subdomain) resolves again on the next request
  clearTenantCache()

  await createAuditLog({
    userId: opts.actorId,
    action: "UPDATE",
    entityType: "ENTERPRISE",
    entityId: enterprise.id,
    description: `${next ? "Activated" : "Deactivated"} enterprise: ${enterprise.name}`,
    oldValues: { isActive: enterprise.isActive },
    newValues: { isActive: next },
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    enterpriseId: enterprise.id,
  })

  return { ok: true, enterprise: { id: enterprise.id, name: enterprise.name, isActive: next } }
}

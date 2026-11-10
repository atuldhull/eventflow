import prisma from "@/lib/prisma"
import type { TenantContext } from "@/lib/tenant"
import { liveWorkspaceWhere } from "@/lib/public-events"

export function getTenantEventFilter(tenant: TenantContext | null) {
  if (!tenant) return { deletedAt: null }

  if (tenant.type === "enterprise") {
    return {
      deletedAt: null,
      OR: [
        { enterpriseId: tenant.id },
        { organization: { enterpriseId: tenant.id } },
      ],
    }
  }

  return { deletedAt: null, organizationId: tenant.id }
}

export async function verifyEntityBelongsToTenant(
  entityType: "event" | "organization",
  entityId: string,
  tenant: TenantContext
): Promise<boolean> {
  if (entityType === "event") {
    const event = await prisma.event.findFirst({
      where: {
        id: entityId,
        ...getTenantEventFilter(tenant),
      },
    })
    return !!event
  }

  if (entityType === "organization" && tenant.type === "enterprise") {
    const org = await prisma.organization.findFirst({
      where: { id: entityId, enterpriseId: tenant.id },
    })
    return !!org
  }

  return false
}

export async function getTenantEvents(tenant: TenantContext, params?: { page?: number; limit?: number; status?: string }) {
  const page = params?.page || 1
  const limit = params?.limit || 12

  const where: Record<string, unknown> = {
    ...getTenantEventFilter(tenant),
    status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING", "COMPLETED"] },
    visibility: "PUBLIC", // listings show PUBLIC only; UNLISTED stays reachable by direct link
    // a deactivated or deleted organization of this enterprise takes its events off the site
    ...liveWorkspaceWhere(),
  }
  if (params?.status) where.status = params.status

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where: where as any,
      orderBy: { startDate: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, title: true, slug: true, shortDescription: true, coverImage: true,
        category: true, startDate: true, venue: true, venueCity: true, isOnline: true,
        isPaid: true, currentRegistrations: true, maxCapacity: true, status: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.event.count({ where: where as any }),
  ])

  return { events, total, page, totalPages: Math.ceil(total / limit) }
}

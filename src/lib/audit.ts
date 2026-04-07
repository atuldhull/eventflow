import prisma from "@/lib/prisma"
import type { AuditAction, Prisma } from "@prisma/client"

interface CreateAuditLogParams {
  userId: string
  action: AuditAction
  entityType: string
  entityId: string
  description?: string
  oldValues?: Prisma.InputJsonValue
  newValues?: Prisma.InputJsonValue
  ipAddress?: string
  userAgent?: string
  eventId?: string
  enterpriseId?: string
  organizationId?: string
}

export async function createAuditLog(data: CreateAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        description: data.description,
        oldValues: data.oldValues ?? undefined,
        newValues: data.newValues ?? undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        eventId: data.eventId,
        enterpriseId: data.enterpriseId,
        organizationId: data.organizationId,
      },
    })
  } catch (error) {
    console.error("Failed to create audit log:", error)
  }
}

export function getClientInfo(request: Request): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  }
}

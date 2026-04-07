import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withSuperAdmin } from "@/lib/guards"
import prisma from "@/lib/prisma"
import { createAuditLog, getClientInfo } from "@/lib/audit"

// Impersonation generates a temporary token-like URL for debugging
// In production this would create a temporary session — here we return user details
// so the super-admin can understand the user's context

export const POST = withSuperAdmin(async (req, { user }) => {
  const { userId } = await req.json()

  if (!userId) {
    return NextResponse.json({ success: false, message: "User ID required" }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, isBanned: true,
      enterpriseMemberships: { select: { enterprise: { select: { name: true } }, role: true }, where: { isActive: true } },
      organizationMemberships: { select: { organization: { select: { name: true } }, role: true }, where: { isActive: true } },
      registrations: { select: { event: { select: { title: true } }, status: true }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  })

  if (!targetUser) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
  }

  // Block impersonating other super admins
  if (targetUser.role === "SUPER_ADMIN" && targetUser.id !== user.id) {
    return NextResponse.json({ success: false, message: "Cannot impersonate another Super Admin" }, { status: 403 })
  }

  const { ipAddress, userAgent } = getClientInfo(req)
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "USER",
    entityId: userId,
    description: `Impersonation view: ${targetUser.name} (${targetUser.email})`,
    ipAddress,
    userAgent,
  })

  return NextResponse.json({
    success: true,
    data: {
      user: { id: targetUser.id, name: targetUser.name, email: targetUser.email, role: targetUser.role, isBanned: targetUser.isBanned },
      memberships: {
        enterprises: targetUser.enterpriseMemberships.map((m) => ({ name: m.enterprise.name, role: m.role })),
        organizations: targetUser.organizationMemberships.map((m) => ({ name: m.organization.name, role: m.role })),
      },
      recentRegistrations: targetUser.registrations.map((r) => ({ event: r.event.title, status: r.status })),
    },
  })
})

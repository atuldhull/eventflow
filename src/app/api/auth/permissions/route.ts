import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  getContextRole,
  getUserPermissions,
  getUserEnterprises,
  getUserOrganizations,
  isEnterpriseOwner,
} from "@/lib/authorization"

/**
 * The signed-in user's permissions in the current workspace, plus the workspaces they can
 * open. `role` is the global User.role (it only means something in the platform area);
 * `enterpriseRole` / `organizationRole` are the roles they hold IN the requested enterprise
 * / organization (null when they have no access there), which is what any role-rank
 * decision in the workspace UI must use.
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    )
  }

  const userId = session.user.id
  const searchParams = request.nextUrl.searchParams
  const enterpriseId = searchParams.get("enterpriseId") || undefined
  const organizationId = searchParams.get("organizationId") || undefined
  const eventId = searchParams.get("eventId") || undefined

  const [permissions, enterprises, organizations, enterpriseRole, organizationRole, ownsEnterprise] = await Promise.all([
    getUserPermissions(userId, { enterpriseId, organizationId, eventId }),
    getUserEnterprises(userId),
    getUserOrganizations(userId, enterpriseId),
    enterpriseId ? getContextRole(userId, { enterpriseId }) : Promise.resolve(null),
    organizationId ? getContextRole(userId, { organizationId }) : Promise.resolve(null),
    enterpriseId ? isEnterpriseOwner(enterpriseId, userId) : Promise.resolve(false),
  ])

  return NextResponse.json({
    success: true,
    role: session.user.role,
    enterpriseRole,
    organizationRole,
    isEnterpriseOwner: !!enterpriseRole && ownsEnterprise,
    permissions,
    context: {
      enterpriseId: enterpriseId || null,
      organizationId: organizationId || null,
      eventId: eventId || null,
    },
    accessibleEnterprises: enterprises.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      logo: e.logo,
      role: "role" in e ? e.role : undefined,
    })),
    accessibleOrganizations: organizations.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      logo: o.logo,
      enterpriseId: o.enterpriseId,
      role: "role" in o ? o.role : undefined,
    })),
  })
}

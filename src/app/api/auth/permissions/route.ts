import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getUserPermissions, getUserEnterprises, getUserOrganizations } from "@/lib/authorization"
import type { Role } from "@/lib/constants"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const enterpriseId = searchParams.get("enterpriseId") || undefined
  const organizationId = searchParams.get("organizationId") || undefined
  const eventId = searchParams.get("eventId") || undefined

  const [permissions, enterprises, organizations] = await Promise.all([
    getUserPermissions(session.user.id, { enterpriseId, organizationId, eventId }),
    getUserEnterprises(session.user.id),
    getUserOrganizations(session.user.id, enterpriseId),
  ])

  return NextResponse.json({
    success: true,
    role: session.user.role,
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

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import type { Role } from "@/lib/constants"
import type { Permission } from "@/lib/permissions"
import { isAdminRole } from "@/lib/permissions"
import { getUserPermissions, authorize } from "@/lib/authorization"

interface AuthenticatedUser {
  id: string
  email: string
  name: string
  role: Role
}

interface HandlerContext {
  user: AuthenticatedUser
  params: Record<string, string>
  permissions: Permission[]
}

type AuthenticatedHandler = (
  req: NextRequest,
  context: HandlerContext
) => Promise<NextResponse>

type ContextExtractor = (
  req: NextRequest,
  params: Record<string, string>
) => Promise<{ enterpriseId?: string; organizationId?: string; eventId?: string }>

export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest, routeContext?: { params?: Promise<Record<string, string>> }) => {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "You must be logged in to access this resource." },
        { status: 401 }
      )
    }

    const params = routeContext?.params ? await routeContext.params : {}

    const user: AuthenticatedUser = {
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name || "",
      role: (session.user.role || "USER") as Role,
    }

    const permissions = await getUserPermissions(user.id)

    return handler(req, { user, params, permissions })
  }
}

export function withRole(roles: Role | Role[], handler: AuthenticatedHandler) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles]

  return withAuth(async (req, context) => {
    if (!allowedRoles.includes(context.user.role)) {
      return NextResponse.json(
        {
          success: false,
          message: `Your role (${context.user.role}) does not have access to this feature.`,
        },
        { status: 403 }
      )
    }

    return handler(req, context)
  })
}

export function withPermission(
  permission: Permission | Permission[],
  contextExtractor?: ContextExtractor
) {
  return (handler: AuthenticatedHandler) => {
    return withAuth(async (req, context) => {
      const authContext = contextExtractor
        ? await contextExtractor(req, context.params)
        : undefined

      const result = await authorize(context.user.id, permission, authContext)

      if (!result.authorized) {
        return NextResponse.json(
          { success: false, message: result.message || "You don't have permission to perform this action." },
          { status: 403 }
        )
      }

      // Refresh permissions with context
      if (authContext) {
        context.permissions = await getUserPermissions(context.user.id, authContext)
      }

      return handler(req, context)
    })
  }
}

export function withAdminAccess(handler: AuthenticatedHandler) {
  return withAuth(async (req, context) => {
    if (!isAdminRole(context.user.role)) {
      return NextResponse.json(
        { success: false, message: "Admin access required." },
        { status: 403 }
      )
    }

    return handler(req, context)
  })
}

export function withSuperAdmin(handler: AuthenticatedHandler) {
  return withRole("SUPER_ADMIN", handler)
}

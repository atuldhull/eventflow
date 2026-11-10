import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { validateApiKey, checkScope } from "@/lib/api-keys"
import { rateLimiter } from "@/lib/rate-limiter"
import { PLAN_CONFIG, getEntityPlan, resolvePlanScope, type PlanScope } from "@/lib/subscription"

export interface ApiContext {
  apiKeyId: string
  userId: string
  organizationId?: string | null
  enterpriseId?: string | null
  scopes: string[]
}

type ApiKeyTenant = Pick<ApiContext, "organizationId" | "enterpriseId">

/**
 * The events an API key may reach: an organization key only its organization's; an
 * enterprise key only its enterprise's (enterprise-level events and those of its
 * organizations). A key linked to neither (its organization was removed) reaches none.
 * Use it inside AND, so it never collides with the caller's own id / OR keys.
 */
export function apiKeyEventWhere(ctx: ApiKeyTenant): Prisma.EventWhereInput {
  if (ctx.organizationId) return { organizationId: ctx.organizationId }
  if (ctx.enterpriseId) return { OR: [{ enterpriseId: ctx.enterpriseId }, { organization: { enterpriseId: ctx.enterpriseId } }] }
  return { id: { in: [] } }
}

/**
 * The event `eventId` when this key may reach it (and it isn't deleted), else null. Routes
 * answer null with 404 "Event not found", so another tenant's event looks like a missing one.
 */
export function findApiKeyEvent(ctx: ApiKeyTenant, eventId: string) {
  return prisma.event.findFirst({
    where: { id: String(eventId), deletedAt: null, AND: [apiKeyEventWhere(ctx)] },
    select: { id: true },
  })
}

export const EVENT_NOT_FOUND = { error: { code: "not_found", message: "Event not found" } } as const

type ApiHandler = (req: NextRequest, context: ApiContext, routeContext?: any) => Promise<NextResponse>

export function withApiAuth(requiredScope: string, handler: ApiHandler) {
  return async (req: NextRequest, routeContext?: any) => {
    const requestId = crypto.randomUUID()
    const authHeader = req.headers.get("authorization")
    const apiKeyHeader = req.headers.get("x-api-key")
    const key = authHeader?.replace(/^Bearer\s+/i, "") || apiKeyHeader

    if (!key) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "API key required. Use Authorization: Bearer <key>" } },
        { status: 401, headers: { "X-Request-Id": requestId } }
      )
    }

    const result = await validateApiKey(key)

    if (!result.valid || !result.apiKey) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: result.error || "Invalid API key" } },
        { status: 401, headers: { "X-Request-Id": requestId } }
      )
    }

    if (!checkScope(result.apiKey.scopes, requiredScope)) {
      return NextResponse.json(
        { error: { code: "forbidden", message: `Insufficient scope. Required: ${requiredScope}` } },
        { status: 403, headers: { "X-Request-Id": requestId } }
      )
    }

    // API access is a paid plan feature (PLAN_CONFIG.features.apiAccess). Orgs inside an
    // enterprise use the enterprise's plan, the same resolution as the event limit.
    const planScope: PlanScope | null = result.apiKey.organizationId
      ? await resolvePlanScope(result.apiKey.organizationId)
      : result.apiKey.enterpriseId
        ? { entityType: "enterprise", entityId: result.apiKey.enterpriseId }
        : null
    const plan = planScope ? await getEntityPlan(planScope.entityType, planScope.entityId) : null
    if (!plan || !PLAN_CONFIG[plan].features.apiAccess) {
      return NextResponse.json(
        { error: { code: "forbidden", message: "API access is not included in this plan. Upgrade to Pro or Enterprise to use the EventFlow API." } },
        { status: 403, headers: { "X-Request-Id": requestId } }
      )
    }

    // Enforce rate limiting per API key
    const rateLimit = result.apiKey.rateLimit || 100
    const rl = await rateLimiter.check(`apikey:${result.apiKey.id}`, rateLimit, 60 * 1000)

    if (!rl.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many requests. Try again later." } },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-Request-Id": requestId,
          },
        }
      )
    }

    const response = await handler(req, {
      apiKeyId: result.apiKey.id,
      userId: result.apiKey.createdById || "",
      organizationId: result.apiKey.organizationId,
      enterpriseId: result.apiKey.enterpriseId,
      scopes: result.apiKey.scopes,
    }, routeContext)

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", String(rateLimit))
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining))
    response.headers.set("X-Request-Id", requestId)

    return response
  }
}

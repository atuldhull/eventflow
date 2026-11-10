import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { getPostLoginPath } from "@/lib/auth-redirect"
import { routeSetsOwnCsp } from "@/lib/route-csp"
import { allowedDuringMaintenance, DEFAULT_PLATFORM_SETTINGS, sessionTimedOut, type PlatformSettings } from "@/lib/platform-settings"
import { escapeHtml } from "@/lib/escape-html"

const PUBLIC_ROUTES = [
  "/",
  "/events",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify",
  "/pricing",
  "/contact",
  "/about",
  "/privacy",
  "/terms",
  "/refunds",
  "/for-organizers",
  "/developers",
  "/offline",
  "/api/health",
  "/api/health/ready",
  "/api/events",
  "/api/events/featured",
  "/api/stats",
  "/api/search",
  "/api/contact",
  // Browser crash reports from the error pages (size-capped, limited per IP)
  "/api/client-errors",
  "/api/certificates/verify",
  // Inbound webhooks are called by the provider's servers; the route verifies the signature
  "/api/webhooks/razorpay",
]

const PUBLIC_PREFIXES = [
  "/events/",
  "/org/",
  "/enterprise/",
  "/verify/",
  "/embed/",
  "/uploads/",
  "/api/v1/",
  // public, read-only org/enterprise profiles (no private fields)
  "/api/public/",
  "/api/events/",
  "/api/auth/",
  // Called by the scheduler with a CRON_SECRET bearer token, never with a session
  "/api/cron/",
]

const ADMIN_ROLES = [
  "ENTERPRISE_ADMIN",
  "ENTERPRISE_MANAGER",
  "ORG_ADMIN",
  "EVENT_MANAGER",
  "COORDINATOR",
  "FINANCE_MANAGER",
  "VIEWER",
]

// Areas that need a session: signed-out visitors are sent to sign in and come back after
const SIGNED_IN_AREAS = ["/dashboard", "/admin", "/super-admin", "/site"]

// Any signed-in user may open the workspace picker and create their first organization
const ADMIN_ONBOARDING_PATHS = ["/admin", "/admin/create-org"]

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://api.razorpay.com https://*.supabase.com",
  // www.openstreetmap.org: the venue map embed (VenueMap)
  "frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.openstreetmap.org",
].join("; ") + ";"

// Root-level files from /public (sw.js, manifest.json, robots.txt, ...) and asset folders.
// Only these skip the auth check: a dot anywhere else in the path is just part of a route
// segment (e.g. /dashboard/tickets/a.b would still render the [id] page).
const STATIC_PREFIXES = ["/_next/", "/images/", "/icons/", "/fonts/"]
const ROOT_STATIC_FILE = /^\/[^/]+\.(?:js|mjs|json|webmanifest|txt|xml|ico|png|jpe?g|gif|svg|webp|avif|css|map|woff2?|ttf|otf)$/i

const SESSION_COOKIE = "authjs.session-token"
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}

function isStaticAsset(pathname: string): boolean {
  return STATIC_PREFIXES.some((p) => pathname.startsWith(p)) || ROOT_STATIC_FILE.test(pathname)
}

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true
  if (pathname === "/api/auth") return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

/**
 * Auth.js v5 session cookies are encrypted JWTs (JWE), so they must be decrypted with
 * AUTH_SECRET; the salt is the cookie name, which carries the __Secure- prefix on HTTPS.
 */
async function readSession(request: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) return null
  const secure = request.cookies
    .getAll()
    .some((c) => c.name === SECURE_SESSION_COOKIE || c.name.startsWith(`${SECURE_SESSION_COOKIE}.`))
  const cookieName = secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE
  const token = await getToken({ req: request, secret, secureCookie: secure, cookieName, salt: cookieName })
  // Settings → Security → Session timeout: an idle session counts as signed out here too
  // (the jwt callback ends it for good on its next read)
  if (token && sessionTimedOut((token.lastActive ?? token.authTime) as number | undefined, await activeSettings())) {
    return null
  }
  return token
}

/** Platform settings (30-second cache), or the defaults when they can't be read. */
async function activeSettings(): Promise<PlatformSettings> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { getActivePlatformSettings } = await import("@/lib/platform-settings-store")
      return await getActivePlatformSettings()
    } catch (error) {
      console.error("[middleware] platform settings lookup failed", error)
    }
  }
  return DEFAULT_PLATFORM_SETTINGS
}

/**
 * /admin is membership-scoped: a user whose global role is USER can still be an org or
 * enterprise member (invites keep the global role) or event staff, and an org creator's
 * token still says USER until it refreshes. The token can't answer that, so ask the DB.
 *
 * Prisma only runs on the Node.js runtime (config.runtime below). The guard keeps it out
 * of any Edge build; there the check fails closed and only admin roles get past /admin.
 */
async function hasWorkspaceAccess(userId: string): Promise<boolean> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { default: prisma } = await import("@/lib/prisma")
      const match = await prisma.user.findFirst({
        where: {
          id: userId,
          OR: [
            { organizationMemberships: { some: { isActive: true, organization: { isActive: true } } } },
            { enterpriseMemberships: { some: { isActive: true, enterprise: { isActive: true } } } },
            { eventsManaged: { some: { isActive: true } } },
          ],
        },
        select: { id: true },
      })
      return match !== null
    } catch (error) {
      console.error("[middleware] workspace lookup failed", error)
    }
  }
  return false
}

/**
 * Maintenance mode: the MAINTENANCE_MODE env var, or the switch on /super-admin/settings
 * (platform settings, read through a 30-second cache). Like the workspace check above,
 * the settings read needs the Node.js runtime; if it fails the site stays up.
 */
async function maintenanceState(): Promise<{ enabled: boolean; message: string }> {
  const fallback = "We're performing scheduled maintenance. Please check back shortly."
  if (process.env.MAINTENANCE_MODE === "true") {
    return { enabled: true, message: process.env.MAINTENANCE_MESSAGE || fallback }
  }
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { getActivePlatformSettings } = await import("@/lib/platform-settings-store")
      const { maintenance } = await getActivePlatformSettings()
      if (maintenance.enabled) return { enabled: true, message: maintenance.message || fallback }
    } catch (error) {
      console.error("[middleware] platform settings lookup failed", error)
    }
  }
  return { enabled: false, message: "" }
}

function maintenanceResponse(pathname: string, message: string) {
  const headers = { "Retry-After": "300", "Cache-Control": "no-store" }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, maintenance: true, message }, { status: 503, headers })
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Down for maintenance</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:20vh auto;padding:0 16px;line-height:1.5"><h1 style="font-size:1.4rem">We'll be right back</h1><p>${escapeHtml(message)}</p></body></html>`
  return new NextResponse(html, { status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } })
}

// Paths that should never be rewritten to the site renderer
const EXCLUDED_FROM_SITE = ["/admin", "/super-admin", "/api", "/dashboard", "/login", "/signup", "/embed", "/_next", "/images", "/icons", "/fonts", "/forgot-password", "/reset-password", "/verify-email", "/verify", "/site"]

function isSiteExcluded(pathname: string) {
  return EXCLUDED_FROM_SITE.some((p) => pathname.startsWith(p)) || pathname.includes(".")
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static files and Next.js internals
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  // ── Subdomain Tenant Detection ──
  const hostname = request.headers.get("host") || ""
  const mainDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "eventflow.com"
  const isSubdomain = hostname !== mainDomain && hostname !== `www.${mainDomain}` && !hostname.startsWith("localhost") && !hostname.startsWith("127.0.0.1") && hostname.endsWith(`.${mainDomain}`)

  if (isSubdomain && !isSiteExcluded(pathname)) {
    const subdomain = hostname.replace(`.${mainDomain}`, "")
    // Rewrite to /site route group with tenant context in headers
    const url = request.nextUrl.clone()
    url.pathname = pathname === "/" ? "/site" : `/site${pathname}`

    const response = NextResponse.rewrite(url)
    response.headers.set("x-tenant-slug", subdomain)
    response.headers.set("x-tenant-host", hostname)

    // Add security headers
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    return response
  }

  // Add security headers
  const response = NextResponse.next()
  // Allow iframe embedding for /embed/* routes, deny for all others
  response.headers.set("X-Frame-Options", pathname.startsWith("/embed") ? "ALLOWALL" : "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")
  // /uploads/* and the certificate download send a stricter CSP of their own
  if (!routeSetsOwnCsp(pathname)) {
    response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY)
  }

  // Maintenance mode: only health checks, the super-admin area and signing in stay up
  if (!allowedDuringMaintenance(pathname)) {
    const maintenance = await maintenanceState()
    if (maintenance.enabled) return maintenanceResponse(pathname, maintenance.message)
  }

  // Redirect signed-in users away from the auth pages (an ?error= from Auth.js still shows)
  if ((pathname === "/login" || pathname === "/signup") && !request.nextUrl.searchParams.has("error")) {
    const session = await readSession(request)
    if (session) {
      const target = getPostLoginPath(request.nextUrl.searchParams.get("callbackUrl"), session.role as string | undefined)
      return NextResponse.redirect(new URL(target, request.url))
    }
    return response
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return response
  }

  // Guest checkout: the route takes a name and email instead of a session and only
  // accepts free tickets from guests. Just this POST; /api/registrations/* still needs one.
  if (pathname === "/api/registrations" && request.method === "POST") {
    return response
  }

  const session = await readSession(request)
  if (!session) {
    // An API call (e.g. from a page whose session just expired) gets a JSON 401 it can
    // handle, not a redirect to the login page's HTML
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }
    // Only the signed-in areas send a visitor to sign in. Any other address isn't a page
    // (public pages are allowed above), so Next.js shows "Page not found" instead of a
    // sign-in form for a mistyped or old link.
    if (!SIGNED_IN_AREAS.some((base) => isUnder(pathname, base))) {
      return response
    }
    const loginUrl = new URL("/login", request.url)
    // Keep the query so the user comes back to the same view after signing in
    loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  const role = session.role as string | undefined

  // Super admin routes
  if (isUnder(pathname, "/super-admin") && role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Admin routes: admin roles, or any user who belongs to a workspace
  if (
    isUnder(pathname, "/admin") &&
    role !== "SUPER_ADMIN" &&
    !(role && ADMIN_ROLES.includes(role)) &&
    !ADMIN_ONBOARDING_PATHS.includes(pathname) &&
    !(session.id && (await hasWorkspaceAccess(session.id)))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  // Node.js runtime so the /admin membership check can use Prisma (stable since Next 15.5)
  runtime: "nodejs",
}

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

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
  "/for-organizers",
  "/developers",
  "/api/health",
  "/api/health/ready",
  "/api/events",
  "/api/events/featured",
  "/api/stats",
  "/api/search",
  "/api/contact",
  "/api/certificates/verify",
]

const AUTH_API_ROUTES = [
  "/api/auth",
  "/api/auth/signup",
  "/api/auth/send-otp",
  "/api/auth/verify-email",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/login-otp",
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

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true
  if (pathname.startsWith("/events/")) return true
  if (pathname.startsWith("/org/")) return true
  if (pathname.startsWith("/enterprise/")) return true
  if (pathname.startsWith("/verify/")) return true
  if (pathname.startsWith("/embed/")) return true
  if (pathname.startsWith("/api/v1/")) return true
  if (pathname.startsWith("/api/events/")) return true
  if (AUTH_API_ROUTES.some((route) => pathname.startsWith(route))) return true
  return false
}

// Paths that should never be rewritten to the site renderer
const EXCLUDED_FROM_SITE = ["/admin", "/super-admin", "/api", "/dashboard", "/login", "/signup", "/embed", "/_next", "/images", "/icons", "/fonts", "/forgot-password", "/reset-password", "/verify-email", "/verify", "/site"]

function isSiteExcluded(pathname: string) {
  return EXCLUDED_FROM_SITE.some((p) => pathname.startsWith(p)) || pathname.includes(".")
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/fonts") ||
    pathname.includes(".")
  ) {
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
  response.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.razorpay.com https://*.supabase.com; frame-src https://api.razorpay.com https://checkout.razorpay.com;")

  // Maintenance mode — allow super-admin and health check only
  if (process.env.MAINTENANCE_MODE === "true") {
    const isHealthCheck = pathname.startsWith("/api/health")
    const isSuperAdminPath = pathname.startsWith("/super-admin") || pathname.startsWith("/api/super-admin")
    if (!isHealthCheck && !isSuperAdminPath) {
      return new NextResponse(
        JSON.stringify({ maintenance: true, message: process.env.MAINTENANCE_MESSAGE || "We're performing scheduled maintenance. Please check back shortly." }),
        { status: 503, headers: { "Content-Type": "application/json", "Retry-After": "300" } }
      )
    }
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return response
  }

  // Check for auth token
  const token =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token") ||
    request.cookies.get("next-auth.session-token") ||
    request.cookies.get("__Secure-next-auth.session-token")

  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Decode JWT to check role (basic check — full validation happens in NextAuth)
  try {
    const payload = JSON.parse(
      Buffer.from(token.value.split(".")[1] || "", "base64").toString()
    )
    const role = payload?.role as string | undefined

    // Super admin routes
    if (pathname.startsWith("/super-admin") && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // Admin routes
    if (pathname.startsWith("/admin") && role && !ADMIN_ROLES.includes(role) && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // Redirect authenticated users away from auth pages
    if (pathname === "/login" || pathname === "/signup") {
      if (role === "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/super-admin", request.url))
      }
      if (role && ADMIN_ROLES.includes(role)) {
        return NextResponse.redirect(new URL("/admin", request.url))
      }
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  } catch {
    // Token parsing failed — let NextAuth handle it
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

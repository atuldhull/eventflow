import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { encode } from "next-auth/jwt"

const prismaMock = vi.hoisted(() => ({ user: { findFirst: vi.fn() } }))
vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }))

import { middleware } from "@/middleware"

const SECRET = "test-secret-for-middleware-specs-0123456789abcdef"
const BASE = "http://localhost:3000"

async function sessionCookie(role: string, opts: { secure?: boolean; id?: string } = {}) {
  const name = opts.secure ? "__Secure-authjs.session-token" : "authjs.session-token"
  const value = await encode({ secret: SECRET, salt: name, token: { id: opts.id ?? "user-1", sub: opts.id ?? "user-1", role } })
  return `${name}=${value}`
}

function req(path: string, cookie?: string, init: { method?: string } = {}) {
  const headers: Record<string, string> = { host: "localhost:3000" }
  if (cookie) headers.cookie = cookie
  return new NextRequest(`${BASE}${path}`, { headers, method: init.method })
}

const passed = (res: Response) => res.headers.get("x-middleware-next") === "1"
const location = (res: Response) => res.headers.get("location")?.replace(BASE, "") ?? null

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", SECRET)
  vi.stubEnv("NEXT_RUNTIME", "nodejs")
  vi.stubEnv("MAINTENANCE_MODE", "")
  prismaMock.user.findFirst.mockReset()
  prismaMock.user.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("middleware: anonymous access", () => {
  it.each(["/dashboard", "/admin", "/admin/org", "/super-admin"])("redirects %s to login with callbackUrl", async (path) => {
    const res = await middleware(req(path))
    expect(res.status).toBe(307)
    expect(location(res)).toBe(`/login?callbackUrl=${encodeURIComponent(path)}`)
  })

  it.each(["/", "/events", "/login", "/offline", "/uploads/does-not-exist", "/uploads/org/logo.png", "/api/cron/reminders"])(
    "lets %s through",
    async (path) => {
      expect(passed(await middleware(req(path)))).toBe(true)
    },
  )

  it("lets the Razorpay webhook POST through", async () => {
    expect(passed(await middleware(req("/api/webhooks/razorpay", undefined, { method: "POST" })))).toBe(true)
  })

  it.each(["/sw.js", "/manifest.json", "/robots.txt", "/icons/icon-192.png", "/_next/data/x.json"])("treats %s as a static asset", async (path) => {
    expect(passed(await middleware(req(path)))).toBe(true)
  })

  it.each(["/dashboard/tickets/a.b", "/super-admin/a.b", "/admin/org.x", "/admin/org/events/x.json"])(
    "does not skip auth for %s just because it contains a dot",
    async (path) => {
      const res = await middleware(req(path))
      expect(res.status).toBe(307)
      expect(location(res)).toMatch(/^\/login\?callbackUrl=/)
    },
  )

  it.each(["/no-such-page", "/dashbord", "/events-old/x"])("lets %s through to the 404 page instead of sign-in", async (path) => {
    expect(passed(await middleware(req(path)))).toBe(true)
  })

  it("keeps the query string in the callbackUrl", async () => {
    const res = await middleware(req("/dashboard/tickets?tab=past"))
    expect(location(res)).toBe(`/login?callbackUrl=${encodeURIComponent("/dashboard/tickets?tab=past")}`)
  })

  it("answers a signed-out API call with a JSON 401 instead of the login page", async () => {
    const res = await middleware(req("/api/users/me/profile"))
    expect(res.status).toBe(401)
    expect(res.headers.get("location")).toBeNull()
    expect(await res.json()).toEqual({ success: false, message: "Unauthorized" })
  })

  it("lets a guest POST a registration but nothing else under /api/registrations", async () => {
    expect(passed(await middleware(req("/api/registrations", undefined, { method: "POST" })))).toBe(true)
    expect((await middleware(req("/api/registrations"))).status).toBe(401)
    expect((await middleware(req("/api/registrations/reg-1/cancel", undefined, { method: "POST" }))).status).toBe(401)
  })

  it.each(["/api/auth/csrf", "/api/auth/session", "/api/auth/providers", "/api/auth/callback/credentials", "/api/auth/send-otp"])(
    "never blocks the sign-in endpoint %s",
    async (path) => {
      expect(passed(await middleware(req(path, undefined, { method: path.includes("callback") || path.includes("send-otp") ? "POST" : "GET" })))).toBe(true)
    },
  )

  it("treats an undecryptable session cookie as signed out", async () => {
    const res = await middleware(req("/dashboard", "authjs.session-token=not.a.real.token"))
    expect(location(res)).toBe("/login?callbackUrl=%2Fdashboard")
  })
})

describe("middleware: role checks", () => {
  it("keeps non-super-admins out of /super-admin", async () => {
    for (const role of ["USER", "ORG_ADMIN", "ENTERPRISE_ADMIN"]) {
      const res = await middleware(req("/super-admin/users", await sessionCookie(role)))
      expect(location(res)).toBe("/dashboard")
    }
  })

  it("lets a super admin into /super-admin and /admin", async () => {
    const cookie = await sessionCookie("SUPER_ADMIN")
    expect(passed(await middleware(req("/super-admin", cookie)))).toBe(true)
    expect(passed(await middleware(req("/admin/org", cookie)))).toBe(true)
  })

  it("reads the __Secure- cookie with its own salt", async () => {
    const res = await middleware(req("/super-admin", await sessionCookie("SUPER_ADMIN", { secure: true })))
    expect(passed(res)).toBe(true)
  })

  it("lets admin roles into /admin without a database lookup", async () => {
    expect(passed(await middleware(req("/admin/org/events", await sessionCookie("ORG_ADMIN"))))).toBe(true)
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("lets any signed-in user open the workspace picker and create an organization", async () => {
    const cookie = await sessionCookie("USER")
    expect(passed(await middleware(req("/admin", cookie)))).toBe(true)
    expect(passed(await middleware(req("/admin/create-org", cookie)))).toBe(true)
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("sends a USER with no workspace away from /admin pages", async () => {
    const res = await middleware(req("/admin/org", await sessionCookie("USER", { id: "carol" })))
    expect(location(res)).toBe("/dashboard")
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "carol" }) }))
  })

  it("lets a USER who is a member of a workspace into /admin pages", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "member" })
    expect(passed(await middleware(req("/admin/org/events", await sessionCookie("USER", { id: "member" }))))).toBe(true)
  })

  it("fails closed when the membership lookup errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    prismaMock.user.findFirst.mockRejectedValue(new Error("db down"))
    expect(location(await middleware(req("/admin/org", await sessionCookie("USER"))))).toBe("/dashboard")
  })

  it("skips the database outside the Node.js runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge")
    expect(location(await middleware(req("/admin/org", await sessionCookie("USER"))))).toBe("/dashboard")
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })
})

describe("middleware: auth pages", () => {
  it("sends signed-in users from /login to their home", async () => {
    expect(location(await middleware(req("/login", await sessionCookie("USER"))))).toBe("/dashboard")
    expect(location(await middleware(req("/login", await sessionCookie("ORG_ADMIN"))))).toBe("/admin")
    expect(location(await middleware(req("/signup", await sessionCookie("SUPER_ADMIN"))))).toBe("/super-admin")
  })

  it("honours a relative callbackUrl and ignores an external one", async () => {
    const cookie = await sessionCookie("USER")
    expect(location(await middleware(req("/login?callbackUrl=%2Fevents%2Fx%2Fregister", cookie)))).toBe("/events/x/register")
    expect(location(await middleware(req("/login?callbackUrl=%2F%2Fevil.example", cookie)))).toBe("/dashboard")
    expect(location(await middleware(req("/login?callbackUrl=%2F.%2F%2Fevil.example", cookie)))).toBe("/dashboard")
    expect(location(await middleware(req("/login?callbackUrl=https%3A%2F%2Fevil.example", cookie)))).toBe("/dashboard")
  })

  it("does not loop when the callbackUrl points back at an auth page", async () => {
    const cookie = await sessionCookie("ORG_ADMIN")
    const first = location(await middleware(req("/login?callbackUrl=%2Flogin", cookie)))
    expect(first).toBe("/login")
    // the follow-up request has no callbackUrl, so it lands on the role's home
    expect(location(await middleware(req(first!, cookie)))).toBe("/admin")
  })

  it("still shows the login error page to a signed-in user", async () => {
    expect(passed(await middleware(req("/login?error=true", await sessionCookie("USER"))))).toBe(true)
  })
})

describe("middleware: content security policy", () => {
  it("allows the OpenStreetMap embed in frames and nothing broader", async () => {
    const csp = (await middleware(req("/events/some-event"))).headers.get("content-security-policy") ?? ""
    const frameSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("frame-src")) ?? ""
    expect(frameSrc.split(/\s+/).slice(1)).toEqual([
      "https://api.razorpay.com",
      "https://checkout.razorpay.com",
      "https://www.openstreetmap.org",
    ])
  })
})

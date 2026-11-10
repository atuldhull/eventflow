import { describe, it, expect } from "vitest"
import { getSafeCallbackUrl, getRoleRedirectPath, getPostLoginPath } from "@/lib/auth-redirect"

describe("getSafeCallbackUrl", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/tickets", "/dashboard/tickets"],
    ["/events/x/register?ticket=vip#pay", "/events/x/register?ticket=vip#pay"],
    ["/", "/"],
    ["/admin/../dashboard", "/dashboard"],
  ])("keeps the same-site path %s", (input, expected) => {
    expect(getSafeCallbackUrl(input)).toBe(expected)
  })

  it.each([
    ["https://evil.example/phish"],
    ["http://localhost:3000/dashboard"],
    ["//evil.example"],
    ["//evil.example/dashboard"],
    ["/\\evil.example"],
    ["/\t/evil.example"],
    ["/\n/evil.example"],
    ["/\r\n/evil.example"],
    ["/.//evil.example"],
    ["/x/..//evil.example"],
    ["javascript:alert(1)"],
    ["dashboard"],
    [" /dashboard"],
    [""],
  ])("rejects %j", (input) => {
    expect(getSafeCallbackUrl(input)).toBeNull()
  })

  it("rejects missing values", () => {
    expect(getSafeCallbackUrl(null)).toBeNull()
    expect(getSafeCallbackUrl(undefined)).toBeNull()
  })

  it("never returns something a browser would resolve to another origin", () => {
    const attempts = ["/\\/evil.example", "/%2F%2Fevil.example", "/./\\evil.example", "/x/\\evil.example", "/x/../\\evil.example", "/%09/evil.example"]
    for (const attempt of attempts) {
      const safe = getSafeCallbackUrl(attempt)
      if (safe !== null) expect(new URL(safe, "https://eventflow.test").origin).toBe("https://eventflow.test")
    }
  })
})

describe("getRoleRedirectPath", () => {
  it("sends each role to its home", () => {
    expect(getRoleRedirectPath("SUPER_ADMIN")).toBe("/super-admin")
    for (const role of ["ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER", "ORG_ADMIN", "EVENT_MANAGER", "COORDINATOR", "FINANCE_MANAGER", "VIEWER"]) {
      expect(getRoleRedirectPath(role)).toBe("/admin")
    }
    expect(getRoleRedirectPath("USER")).toBe("/dashboard")
    expect(getRoleRedirectPath(undefined)).toBe("/dashboard")
  })
})

describe("getPostLoginPath", () => {
  it("prefers a safe callbackUrl over the role's home", () => {
    expect(getPostLoginPath("/dashboard/tickets", "SUPER_ADMIN")).toBe("/dashboard/tickets")
  })

  it("falls back to the role's home for a missing or unsafe callbackUrl", () => {
    expect(getPostLoginPath(undefined, "ORG_ADMIN")).toBe("/admin")
    expect(getPostLoginPath("https://evil.example", "SUPER_ADMIN")).toBe("/super-admin")
    expect(getPostLoginPath("//evil.example", "USER")).toBe("/dashboard")
  })
})

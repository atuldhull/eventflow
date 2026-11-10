import { describe, it, expect } from "vitest"
import { routeSetsOwnCsp } from "@/lib/route-csp"

// The middleware leaves its global CSP off exactly these paths, so their own stricter
// policy (sandboxing for uploads, no scripts for the certificate page) is what's sent.
describe("routeSetsOwnCsp", () => {
  it("matches uploaded files and the certificate download", () => {
    expect(routeSetsOwnCsp("/uploads/abc123.png")).toBe(true)
    expect(routeSetsOwnCsp("/api/certificates/cm123/download")).toBe(true)
    expect(routeSetsOwnCsp("/api/certificates/cm123/download/")).toBe(true)
  })
  it("leaves every other path with the global policy", () => {
    for (const path of ["/", "/uploads", "/events/x", "/api/certificates/verify", "/api/certificates/a/b/download", "/api/upload", "/dashboard/certificates"]) {
      expect(routeSetsOwnCsp(path)).toBe(false)
    }
  })
})

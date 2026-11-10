import { describe, it, expect } from "vitest"
import { csvCell, toCsv } from "@/lib/csv-export"
import {
  cleanSearch,
  confirmationMatches,
  enterpriseAuditWhere,
  enterpriseBrandingUpdateSchema,
  enterpriseMemberWhere,
  enterprisePaymentWhere,
  enterpriseSettingsUpdateSchema,
  isSafeImageUrl,
  organizationUpdateSchema,
  parsePaging,
  superAdminEnterpriseUpdateSchema,
  domainSchema,
} from "@/lib/enterprise-admin"
import { DEFAULT_PLATFORM_SETTINGS, changedSections, normalizePlatformSettings, platformSettingsSchema } from "@/lib/platform-settings"

describe("CSV export cells", () => {
  it("defuses every formula trigger at the start of a text cell", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      expect(csvCell(evil).startsWith(`"'`)).toBe(true)
    }
  })

  it("leaves numbers and ordinary text alone, and escapes quotes", () => {
    expect(csvCell(-12.5)).toBe('"-12.5"')
    expect(csvCell("Alice")).toBe('"Alice"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(null)).toBe('""')
    expect(csvCell(new Date("2026-01-02T03:04:05.000Z"))).toBe('"2026-01-02T03:04:05.000Z"')
  })

  it("builds a header row then data rows", () => {
    expect(toCsv(["a", "b"], [["=1", 2]])).toBe('"a","b"\r\n"\'=1","2"')
  })
})

describe("paging and search", () => {
  it("clamps page and limit", () => {
    expect(parsePaging(new URLSearchParams("page=-3&limit=100000"), 20)).toEqual({ page: 1, limit: 100, skip: 0 })
    expect(parsePaging(new URLSearchParams("page=3&limit=abc"), 20)).toEqual({ page: 3, limit: 20, skip: 40 })
  })

  it("trims and caps search", () => {
    expect(cleanSearch("  x  ")).toBe("x")
    expect(cleanSearch("y".repeat(500))).toHaveLength(100)
    expect(cleanSearch(null)).toBe("")
  })
})

describe("enterprise-scoped where clauses", () => {
  it("always scope payments to the enterprise, with and without a search", () => {
    const plain = enterprisePaymentWhere("ent1")
    expect(plain.OR).toBeUndefined()
    const searched = enterprisePaymentWhere("ent1", "alice")
    expect(searched.registration).toEqual(plain.registration)
    expect(JSON.stringify(searched.registration)).toContain("ent1")
    expect(searched.OR).toHaveLength(4)
  })

  it("filters audit logs by enterprise, a known action, and a search that can match an action", () => {
    const where = enterpriseAuditWhere("ent1", { search: "check in", action: "export" })
    expect(where.enterpriseId).toBe("ent1")
    expect(where.action).toBe("EXPORT")
    expect(where.OR).toContainEqual({ action: "CHECK_IN" })
    // an unknown action is ignored rather than passed to Prisma
    expect(enterpriseAuditWhere("ent1", { action: "DROP TABLE" }).action).toBeUndefined()
  })

  it("splits members into active and removed, searching name and email", () => {
    expect(enterpriseMemberWhere("ent1").isActive).toBe(true)
    const removed = enterpriseMemberWhere("ent1", { status: "inactive", search: "bob" })
    expect(removed.isActive).toBe(false)
    expect(removed.enterpriseId).toBe("ent1")
    expect(JSON.stringify(removed.AND)).toContain("bob")
  })
})

describe("request schemas", () => {
  it("enterprise settings: validates fields and clears blanks", () => {
    const ok = enterpriseSettingsUpdateSchema.safeParse({ name: "Demo U", email: "a@b.co", phone: "", type: "", settings: { requireEventApproval: true } })
    expect(ok.success).toBe(true)
    expect(ok.data).toMatchObject({ phone: null, type: null, settings: { requireEventApproval: true } })
    expect(enterpriseSettingsUpdateSchema.safeParse({ email: "nope" }).success).toBe(false)
    expect(enterpriseSettingsUpdateSchema.safeParse({ type: "PIRATES" }).success).toBe(false)
    expect(enterpriseSettingsUpdateSchema.safeParse({ website: "javascript:alert(1)" }).success).toBe(false)
  })

  it("enterprise settings: never lets ownership or lifecycle fields through", () => {
    const parsed = enterpriseSettingsUpdateSchema.parse({ name: "X Corp", ownerId: "u2", deletedAt: null, isActive: false, slug: "x" })
    expect(Object.keys(parsed)).toEqual(["name"])
  })

  it("branding: hex colours, safe image URLs, and no customDomain", () => {
    expect(enterpriseBrandingUpdateSchema.safeParse({ primaryColor: "#12ab9F" }).success).toBe(true)
    expect(enterpriseBrandingUpdateSchema.safeParse({ primaryColor: "red" }).success).toBe(false)
    expect(enterpriseBrandingUpdateSchema.safeParse({ logo: "/uploads/abc-123.png" }).success).toBe(true)
    expect(enterpriseBrandingUpdateSchema.safeParse({ logo: "/uploads/../secret.png" }).success).toBe(false)
    expect(enterpriseBrandingUpdateSchema.safeParse({ logo: "/uploads/doc.pdf" }).success).toBe(false)
    expect(enterpriseBrandingUpdateSchema.parse({ logo: "" })).toEqual({ logo: null })
    expect(enterpriseBrandingUpdateSchema.parse({ customDomain: "evil.com" })).toEqual({})
  })

  it("image URLs: our uploads or https only", () => {
    expect(isSafeImageUrl("https://cdn.example.com/logo.png")).toBe(true)
    expect(isSafeImageUrl("http://cdn.example.com/logo.png")).toBe(false)
    expect(isSafeImageUrl("data:image/png;base64,AAAA")).toBe(false)
    expect(isSafeImageUrl("javascript:alert(1)")).toBe(false)
  })

  it("organization update: cannot move the org to another enterprise or rename its slug", () => {
    const parsed = organizationUpdateSchema.parse({ name: "Tech Club", enterpriseId: "other", slug: "x", id: "y", isActive: false })
    expect(parsed).toEqual({ name: "Tech Club", isActive: false })
  })

  it("super-admin enterprise update: profile fields only", () => {
    const parsed = superAdminEnterpriseUpdateSchema.parse({ name: "Acme", ownerId: "u9", isVerified: true, deletedAt: null })
    expect(parsed).toEqual({ name: "Acme" })
  })

  it("domains: hostnames only", () => {
    expect(domainSchema.parse(" Events.Example.EDU ")).toBe("events.example.edu")
    expect(domainSchema.safeParse("http://x.com").success).toBe(false)
    expect(domainSchema.safeParse("localhost").success).toBe(false)
  })
})

describe("typed confirmation", () => {
  const record = { name: "Temp Enterprise", slug: "temp-enterprise" }
  it("accepts the exact name or slug, ignoring case and outer spaces", () => {
    expect(confirmationMatches("Temp Enterprise", record)).toBe(true)
    expect(confirmationMatches("  temp enterprise ", record)).toBe(true)
    expect(confirmationMatches("temp-enterprise", record)).toBe(true)
  })
  it("rejects anything else", () => {
    expect(confirmationMatches("Temp", record)).toBe(false)
    expect(confirmationMatches("", record)).toBe(false)
    expect(confirmationMatches(undefined, record)).toBe(false)
    expect(confirmationMatches(true, record)).toBe(false)
  })
})

describe("platform settings", () => {
  it("fills missing sections and fields from the defaults", () => {
    const merged = normalizePlatformSettings({ general: { platformName: "Acme Events" }, features: { paymentProcessing: false, smsNotifications: true } })
    expect(merged.general.platformName).toBe("Acme Events")
    expect(merged.general.contactEmail).toBe(DEFAULT_PLATFORM_SETTINGS.general.contactEmail)
    expect(merged.features.paymentProcessing).toBe(false)
    // SMS isn't available (no provider), so a stored "on" reads as off
    expect(merged.features.smsNotifications).toBe(false)
    expect(merged.security).toEqual(DEFAULT_PLATFORM_SETTINGS.security)
  })

  it("drops a stored section that no longer validates", () => {
    const merged = normalizePlatformSettings({ security: { minPasswordLength: 2 } })
    expect(merged.security.minPasswordLength).toBe(DEFAULT_PLATFORM_SETTINGS.security.minPasswordLength)
    expect(normalizePlatformSettings(null)).toEqual(DEFAULT_PLATFORM_SETTINGS)
  })

  it("validates a full document and reports changed sections", () => {
    const next = structuredClone(DEFAULT_PLATFORM_SETTINGS)
    next.maintenance.enabled = true
    expect(platformSettingsSchema.safeParse(next).success).toBe(true)
    expect(changedSections(DEFAULT_PLATFORM_SETTINGS, next)).toEqual(["maintenance"])
    expect(platformSettingsSchema.safeParse({ ...next, security: { ...next.security, maxLoginAttempts: null } }).success).toBe(false)
  })
})

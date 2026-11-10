import type { Prisma } from "@prisma/client"
import { z } from "zod/v4"

/*
 * Shared, pure helpers for the enterprise-admin and super-admin APIs: paging, the
 * enterprise-scoped `where` clauses (so a list and its CSV export always match), and the
 * request schemas. Nothing here touches the database.
 */

// ---------------------------------------------------------------------------
// Paging and search
// ---------------------------------------------------------------------------

export function parsePaging(sp: URLSearchParams, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1))
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(sp.get("limit")) || defaultLimit)))
  return { page, limit, skip: (page - 1) * limit }
}

/** A trimmed, length-capped search term ("" when absent). */
export function cleanSearch(raw: string | null | undefined): string {
  return (raw ?? "").trim().slice(0, 100)
}

const contains = (search: string) => ({ contains: search, mode: "insensitive" as const })

/** First instant of the current month (server time), for "new this month" counts. */
export function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

// ---------------------------------------------------------------------------
// Enterprise-scoped where clauses
// ---------------------------------------------------------------------------

/** Events that belong to the enterprise directly or through one of its organizations. */
export function enterpriseEventScope(enterpriseId: string): Prisma.EventWhereInput {
  return { deletedAt: null, OR: [{ enterpriseId }, { organization: { enterpriseId } }] }
}

export function enterprisePaymentWhere(enterpriseId: string, search = ""): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = { registration: { event: enterpriseEventScope(enterpriseId) } }
  if (search) {
    where.OR = [
      { paymentNumber: contains(search) },
      { user: { name: contains(search) } },
      { user: { email: contains(search) } },
      { registration: { event: { title: contains(search) } } },
    ]
  }
  return where
}

export function enterpriseRegistrationWhere(enterpriseId: string, search = ""): Prisma.RegistrationWhereInput {
  const where: Prisma.RegistrationWhereInput = { event: enterpriseEventScope(enterpriseId) }
  if (search) {
    where.OR = [
      { registrationNumber: contains(search) },
      { user: { name: contains(search) } },
      { user: { email: contains(search) } },
    ]
  }
  return where
}

export const AUDIT_ACTIONS = [
  "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "APPROVE", "REJECT", "REFUND", "CHECK_IN", "PUBLISH", "CANCEL",
] as const
export type AuditActionName = (typeof AUDIT_ACTIONS)[number]

export function enterpriseAuditWhere(
  enterpriseId: string,
  { search = "", action = "" }: { search?: string; action?: string } = {}
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = { enterpriseId }
  const actionFilter = AUDIT_ACTIONS.find((a) => a === action.toUpperCase())
  if (actionFilter) where.action = actionFilter
  if (search) {
    // "check in" / "Check-in" should find CHECK_IN too
    const asAction = AUDIT_ACTIONS.find((a) => a === search.toUpperCase().replace(/[\s-]+/g, "_"))
    where.OR = [
      { description: contains(search) },
      { entityType: contains(search) },
      { user: { name: contains(search) } },
      { user: { email: contains(search) } },
      ...(asAction ? [{ action: asAction }] : []),
    ]
  }
  return where
}

export type MemberStatus = "active" | "inactive"

export function enterpriseMemberWhere(
  enterpriseId: string,
  { search = "", status = "active" }: { search?: string; status?: MemberStatus } = {}
): Prisma.EnterpriseMemberWhereInput {
  const where: Prisma.EnterpriseMemberWhereInput = {
    enterpriseId,
    isActive: status === "active",
    user: { deletedAt: null },
  }
  if (search) {
    where.AND = [{ OR: [{ user: { name: contains(search) } }, { user: { email: contains(search) } }] }]
  }
  return where
}

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

/** "" and whitespace become null, so a cleared optional field clears the column. */
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v)
const optionalText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable())

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #1a2b3c")

/**
 * An image the app may render: a file from our own upload route (png/jpg/webp, the only
 * image types it accepts) or an https URL. Anything else (javascript:, data:, http:) is refused.
 */
export function isSafeImageUrl(url: string): boolean {
  if (/^\/uploads\/[A-Za-z0-9][A-Za-z0-9_-]*\.(png|jpe?g|webp)$/.test(url)) return true
  try {
    const u = new URL(url)
    return u.protocol === "https:" && !!u.hostname
  } catch {
    return false
  }
}
const imageUrlSchema = z.preprocess(
  blankToNull,
  z.string().max(500).refine(isSafeImageUrl, "Upload a PNG, JPG or WebP image").nullable()
)

const websiteSchema = z.preprocess(blankToNull, z.url({ protocol: /^https?$/, error: "Enter a full http(s) address" }).max(300).nullable())

export const ENTERPRISE_TYPES = ["UNIVERSITY", "COMPANY", "NGO", "GOVERNMENT", "OTHER"] as const

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A URL slug: lowercase letters and numbers, words joined by single hyphens. */
export const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters")
  .max(60, "Slug must be 60 characters or fewer")
  .regex(SLUG_PATTERN, "Slug can only use lowercase letters, numbers and single hyphens (like demo-university)")

/** A slug suggestion from a name ("Demo University!" → "demo-university"). */
export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
}

const trimmedEmail = (message: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email(message))

/** POST /api/super-admin/enterprises: the enterprise, and the existing account that will own it. */
export const superAdminEnterpriseCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  slug: slugSchema,
  email: trimmedEmail("Enter a valid contact email"),
  ownerEmail: trimmedEmail("Enter the owner's email address"),
  type: z.preprocess(blankToNull, z.enum(ENTERPRISE_TYPES).nullable()).optional(),
  description: optionalText(2000).optional(),
  phone: optionalText(30).optional(),
  website: websiteSchema.optional(),
})
export type SuperAdminEnterpriseCreate = z.infer<typeof superAdminEnterpriseCreateSchema>

/** Transfer ownership: the new owner's email, and the enterprise name typed as confirmation. */
export const transferOwnershipSchema = z.object({
  newOwnerEmail: trimmedEmail("Enter the new owner's email address"),
  confirm: z.string().min(1, "Type the enterprise name to confirm"),
})

/** Activate or deactivate an enterprise; deactivating needs the name typed as confirmation. */
export const enterpriseStatusSchema = z.object({
  isActive: z.boolean().optional(),
  confirm: z.string().optional(),
})

/** Enterprise-wide event rules kept in Enterprise.settings (merged, other keys preserved). */
export const enterpriseRulesSchema = z.object({
  requireEventApproval: z.boolean(),
  autoGenerateCertificates: z.boolean(),
}).partial()

export const enterpriseSettingsUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  type: z.preprocess(blankToNull, z.enum(ENTERPRISE_TYPES).nullable()),
  description: optionalText(2000),
  email: z.email("Enter a valid email"),
  phone: optionalText(30),
  website: websiteSchema,
  settings: enterpriseRulesSchema,
}).partial()

/** Branding the enterprise can set directly. customDomain is NOT here: it is only set by the DNS-verified domain route. */
export const enterpriseBrandingUpdateSchema = z.object({
  logo: imageUrlSchema,
  banner: imageUrlSchema,
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
}).partial()

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Enter a domain like events.example.edu")

export const ORG_CATEGORIES = [
  "TECHNICAL", "CULTURAL", "SPORTS", "SOCIAL", "ACADEMIC", "PROFESSIONAL", "CORPORATE", "HR", "ENGINEERING", "MARKETING", "OTHER",
] as const

/** What an enterprise admin may change on one of its organizations (never enterpriseId, slug or ids). */
export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(100),
  description: optionalText(1000),
  category: z.string().trim().min(1).max(40),
  email: z.email("Enter a valid email"),
  phone: optionalText(30),
  website: websiteSchema,
  city: optionalText(80),
  state: optionalText(80),
  country: optionalText(80),
  logo: imageUrlSchema,
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  isActive: z.boolean(),
}).partial()

/** Profile fields a super admin may edit on an enterprise (status/verification have their own routes). */
export const superAdminEnterpriseUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email("Enter a valid email"),
  type: z.preprocess(blankToNull, z.enum(ENTERPRISE_TYPES).nullable()),
  description: optionalText(2000),
  phone: optionalText(30),
  website: websiteSchema,
}).partial()

/**
 * A typed confirmation must match the record's name or slug exactly (case-insensitive,
 * surrounding spaces ignored), so a destructive call can't be made by accident or by a
 * script that never showed the name.
 */
export function confirmationMatches(typed: unknown, record: { name: string; slug: string }): boolean {
  if (typeof typed !== "string") return false
  const t = typed.trim().toLowerCase()
  return t.length > 0 && (t === record.name.trim().toLowerCase() || t === record.slug.toLowerCase())
}

/** First validation message, for the `message` field of a 400 response. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return "Validation failed"
  const field = issue.path.join(".")
  return field ? `${field}: ${issue.message}` : issue.message
}

import { z } from "zod/v4"
import { asObject } from "@/lib/org-settings"

/**
 * The organization settings form: which fields it has, how each is validated, and where
 * each one is stored (Organization columns, Organization.socialLinks, or the `billing`
 * and `eventDefaults` keys of Organization.settings).
 */

const optionalText = (max: number) => z.string().trim().max(max)
const blankOr = (pattern: RegExp, message: string) =>
  z.string().trim().refine((v) => v === "" || pattern.test(v), message)
const link = blankOr(/^https?:\/\/[^\s<>"]+$/i, "Enter a full link starting with https://").pipe(z.string().max(300))

export const SOCIAL_KEYS = ["twitter", "instagram", "linkedin"] as const

export const orgProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(120),
    category: optionalText(50),
    description: optionalText(2000),
    email: z.email("Enter a valid email").max(200),
    phone: blankOr(/^\+?[0-9 ()-]{6,20}$/, "Enter a valid phone number"),
    website: link,
    address: optionalText(500),
    city: optionalText(100),
    state: optionalText(100),
    socialLinks: z.object({ twitter: link, instagram: link, linkedin: link }).partial(),
    billing: z
      .object({
        gstin: blankOr(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN"),
        pan: blankOr(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid 10-character PAN"),
        pinCode: blankOr(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code"),
      })
      .partial(),
    eventDefaults: z
      .object({ requireApproval: z.boolean(), autoGenerateCertificates: z.boolean() })
      .partial(),
  })
  .partial()
  .strict()

export type OrgProfileUpdate = z.infer<typeof orgProfileSchema>

/**
 * Upper-cases the tax identifiers before validation (people type them in lower case), and
 * drops the read-only keys GET returns next to the profile: the settings form sends back
 * what it loaded, and the strict schema refused `enterpriseId`, so no organization inside
 * an enterprise could save its settings.
 */
export function normalizeProfileInput(body: unknown): unknown {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { enterpriseId: _readOnly, ...input } = asObject(body)
  const billing = asObject(input.billing)
  if (!input.billing) return input
  return {
    ...input,
    billing: Object.fromEntries(
      Object.entries(billing).map(([k, v]) => [k, typeof v === "string" && k !== "pinCode" ? v.toUpperCase() : v])
    ),
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "")
const bool = (v: unknown) => v === true

/** The form's values from what is stored. */
export function orgProfileFromRecord(org: {
  name: string
  category: string | null
  description: string | null
  email: string
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  socialLinks: unknown
  settings: unknown
}) {
  const social = asObject(org.socialLinks)
  const settings = asObject(org.settings)
  const billing = asObject(settings.billing)
  const defaults = asObject(settings.eventDefaults)
  return {
    name: org.name,
    category: org.category ?? "",
    description: org.description ?? "",
    email: org.email,
    phone: org.phone ?? "",
    website: org.website ?? "",
    address: org.address ?? "",
    city: org.city ?? "",
    state: org.state ?? "",
    socialLinks: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, str(social[k])])) as Record<(typeof SOCIAL_KEYS)[number], string>,
    billing: { gstin: str(billing.gstin), pan: str(billing.pan), pinCode: str(billing.pinCode) },
    eventDefaults: {
      requireApproval: bool(defaults.requireApproval),
      autoGenerateCertificates: bool(defaults.autoGenerateCertificates),
    },
  }
}

export type OrgProfile = ReturnType<typeof orgProfileFromRecord>

/** Organization column values from a validated update; blank optional text is stored as null. */
export function orgColumnsFromUpdate(update: OrgProfileUpdate) {
  const nullable = (v: string | undefined) => (v === undefined ? undefined : v === "" ? null : v)
  const data: Record<string, string | null> = {}
  if (update.name !== undefined) data.name = update.name
  if (update.email !== undefined) data.email = update.email
  for (const key of ["category", "description", "phone", "website", "address", "city", "state"] as const) {
    const value = nullable(update[key])
    if (value !== undefined) data[key] = value
  }
  return data
}

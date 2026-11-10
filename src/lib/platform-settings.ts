import { z } from "zod/v4"
import { hexColorSchema } from "@/lib/enterprise-admin"

/*
 * Platform-wide settings edited on /super-admin/settings: the schema, defaults and pure
 * helpers (safe to import from client components). Storage is in platform-settings-store.ts.
 */

export const PLATFORM_FEATURES = [
  { key: "userRegistration", label: "User registration", description: "Allow new users to sign up" },
  { key: "googleOAuth", label: "Google sign-in", description: "Allow signing in with Google" },
  { key: "microsoftOAuth", label: "Microsoft sign-in", description: "Allow signing in with Microsoft" },
  {
    key: "emailVerificationRequired",
    label: "Email verification required",
    description: "Accounts must verify their email before they can sign in (super admins excepted). Invitations always need a verified address.",
  },
  {
    key: "publicEventCreation",
    label: "Public event creation",
    description: "Any signed-in user may create their own organization (and so host events) without an invitation",
  },
  { key: "enterpriseSelfRegistration", label: "Enterprise self-registration", description: "Allow enterprises to register themselves" },
  { key: "paymentProcessing", label: "Payment processing", description: "Enable paid events and ticketing" },
  { key: "certificateGeneration", label: "Certificate generation", description: "Enable certificate generation for events" },
  { key: "smsNotifications", label: "SMS notifications", description: "Enable SMS notifications" },
] as const

/**
 * Settings shown on /super-admin/settings that the platform can't honour yet. They are
 * displayed switched off and disabled, normalizePlatformSettings reads them as off, and
 * the settings API refuses to switch them on (rather than saving a switch that does nothing).
 */
export const UNAVAILABLE_SETTINGS = {
  smsNotifications: "Requires an SMS provider, which isn't set up yet",
  enterpriseSelfRegistration: "Coming soon: enterprises are created by a super admin for now",
  require2faForAdmins: "Coming soon: two-factor sign-in isn't available yet",
} as const

export type UnavailableSettingKey = keyof typeof UNAVAILABLE_SETTINGS

export type PlatformFeatureKey = (typeof PLATFORM_FEATURES)[number]["key"]

const featuresShape = Object.fromEntries(PLATFORM_FEATURES.map((f) => [f.key, z.boolean()])) as Record<
  PlatformFeatureKey,
  z.ZodBoolean
>

const optionalEmail = z.union([z.literal(""), z.email("Enter a valid email")])

export const platformSettingsSchema = z.object({
  general: z.object({
    platformName: z.string().trim().min(1, "Platform name is required").max(80),
    contactEmail: optionalEmail,
    description: z.string().trim().max(500),
    primaryColor: hexColorSchema,
    secondaryColor: hexColorSchema,
  }),
  features: z.object(featuresShape),
  email: z.object({
    fromName: z.string().trim().max(80),
    fromEmail: optionalEmail,
    replyTo: optionalEmail,
  }),
  security: z.object({
    maxLoginAttempts: z.number().int().min(1).max(50),
    lockoutMinutes: z.number().int().min(1).max(1440),
    sessionTimeoutHours: z.number().int().min(1).max(720),
    minPasswordLength: z.number().int().min(8).max(128),
    require2faForAdmins: z.boolean(),
  }),
  maintenance: z.object({
    enabled: z.boolean(),
    message: z.string().trim().max(500),
  }),
})

export type PlatformSettings = z.infer<typeof platformSettingsSchema>

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  general: {
    platformName: "EventFlow",
    contactEmail: "support@eventflow.com",
    description: "Professional event management platform for universities, colleges, and enterprises.",
    primaryColor: "#09090b",
    secondaryColor: "#ffffff",
  },
  features: {
    userRegistration: true,
    googleOAuth: true,
    microsoftOAuth: true,
    emailVerificationRequired: true,
    // on by default: self-service organization creation (/admin/create-org) is how a new
    // organizer gets started, and it was always allowed before this switch was enforced
    publicEventCreation: true,
    enterpriseSelfRegistration: false,
    paymentProcessing: true,
    certificateGeneration: true,
    smsNotifications: false,
  },
  email: { fromName: "EventFlow", fromEmail: "noreply@eventflow.com", replyTo: "support@eventflow.com" },
  security: { maxLoginAttempts: 5, lockoutMinutes: 15, sessionTimeoutHours: 24, minPasswordLength: 8, require2faForAdmins: false },
  maintenance: { enabled: false, message: "" },
}

/**
 * Merge a stored (possibly partial or outdated) document over the defaults, section by
 * section, dropping anything that no longer validates.
 */
export function normalizePlatformSettings(stored: unknown): PlatformSettings {
  const src = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>
  const out = structuredClone(DEFAULT_PLATFORM_SETTINGS) as Record<string, unknown>
  for (const section of Object.keys(DEFAULT_PLATFORM_SETTINGS) as (keyof PlatformSettings)[]) {
    const merged = {
      ...(DEFAULT_PLATFORM_SETTINGS[section] as object),
      ...((src[section] && typeof src[section] === "object" ? src[section] : {}) as object),
    }
    const parsed = platformSettingsSchema.shape[section].safeParse(merged)
    if (parsed.success) out[section] = parsed.data
  }
  const settings = out as PlatformSettings
  // switches the platform can't honour yet always read as off (see UNAVAILABLE_SETTINGS)
  settings.features.smsNotifications = false
  settings.features.enterpriseSelfRegistration = false
  settings.security.require2faForAdmins = false
  return settings
}

/** The first unavailable setting a save tries to switch on, as a 400 message; null when none. */
export function unavailableSettingIssue(settings: PlatformSettings): string | null {
  const on: [UnavailableSettingKey, boolean][] = [
    ["smsNotifications", settings.features.smsNotifications],
    ["enterpriseSelfRegistration", settings.features.enterpriseSelfRegistration],
    ["require2faForAdmins", settings.security.require2faForAdmins],
  ]
  const hit = on.find(([, value]) => value)
  return hit ? `${UNAVAILABLE_SETTINGS[hit[0]]}, so it can't be switched on.` : null
}

/** Longest session the settings allow (sessionTimeoutHours max), used as the JWT's own maxAge. */
export const MAX_SESSION_SECONDS = 720 * 60 * 60

/**
 * Settings → Security → Session timeout: a session ends after this many hours without
 * activity. `lastActive` is the session's last activity in ms (falls back to its sign-in
 * time); a token with neither (issued before this was tracked) is left alone.
 */
export function sessionTimedOut(lastActive: number | undefined, settings: PlatformSettings, now = Date.now()): boolean {
  if (typeof lastActive !== "number" || !Number.isFinite(lastActive)) return false
  return now - lastActive > settings.security.sessionTimeoutHours * 60 * 60 * 1000
}

/** Settings → Features → Email verification required: does this account need a verified email to sign in? */
export function signInNeedsVerifiedEmail(role: string, settings: PlatformSettings): boolean {
  return settings.features.emailVerificationRequired && role !== "SUPER_ADMIN"
}

/**
 * What the middleware does while maintenance mode is on: everything answers 503 except the
 * health checks, the super-admin area (so it can be switched off again) and signing in.
 */
export function allowedDuringMaintenance(pathname: string): boolean {
  const under = (base: string) => pathname === base || pathname.startsWith(`${base}/`)
  return (
    pathname.startsWith("/api/health") ||
    under("/super-admin") ||
    under("/api/super-admin") ||
    // Auth.js sign-in and session endpoints (not sign-up, OTP or password reset)
    ["/api/auth/csrf", "/api/auth/session", "/api/auth/providers", "/api/auth/signout", "/api/auth/error", "/api/auth/permissions"].includes(pathname) ||
    pathname.startsWith("/api/auth/callback/") ||
    under("/api/auth/signin") ||
    pathname === "/login"
  )
}

/** The platform's minimum password length (never below the built-in 8), as a message when `password` is shorter. */
export function passwordLengthIssue(password: string, settings: PlatformSettings): string | null {
  const min = Math.max(8, settings.security.minPasswordLength)
  return password.length < min ? `Password must be at least ${min} characters` : null
}

/** Which sections differ, for the audit-log description. */
export function changedSections(before: PlatformSettings, after: PlatformSettings): (keyof PlatformSettings)[] {
  return (Object.keys(after) as (keyof PlatformSettings)[]).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
  )
}

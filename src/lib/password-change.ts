import type { Prisma } from "@prisma/client"

/**
 * When a password is reset or changed, the time is kept in User.metadata.passwordChangedAt.
 * The jwt callback in src/lib/auth.ts ends any session that signed in before it at the
 * session's next periodic refresh, so other devices are signed out within that window.
 */

type JsonObject = Record<string, unknown>

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** The recorded password change time in ms, or null if the password has never been changed. */
export function getPasswordChangedAt(metadata: Prisma.JsonValue | null | undefined): number | null {
  if (!isPlainObject(metadata)) return null
  const value = metadata.passwordChangedAt
  if (typeof value !== "string") return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

/** User.metadata with passwordChangedAt set to `at`, keeping every other key. */
export function withPasswordChangedAt(metadata: Prisma.JsonValue | null | undefined, at: Date): Prisma.InputJsonObject {
  const rest = isPlainObject(metadata) ? (metadata as Prisma.InputJsonObject) : {}
  return { ...rest, passwordChangedAt: at.toISOString() }
}

/** Whether a session that signed in at `authTime` (ms) predates the last password change. */
export function signedInBeforePasswordChange(authTime: number | undefined, metadata: Prisma.JsonValue | null | undefined): boolean {
  const changedAt = getPasswordChangedAt(metadata)
  // A token from before sign-in times were recorded counts as older than any change
  return changedAt !== null && (authTime ?? 0) < changedAt
}

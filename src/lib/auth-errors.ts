/**
 * Sign-in error codes and the messages people see for them. Pure, so the client can
 * import it; the server raises the codes from `authorize` in src/lib/auth.ts.
 *
 * Auth.js v5 sends every failed credentials sign-in to the client as
 * `error: "CredentialsSignin"`. When `authorize` throws a `CredentialsSignin` subclass,
 * its `code` arrives alongside (`result.code`, or `?code=` on a redirect); a plain
 * `return null` arrives as code "credentials". Any other throw becomes "Configuration".
 */

export const SIGN_IN_ERROR_CODES = [
  "ACCOUNT_INACTIVE",
  "ACCOUNT_BANNED",
  "EMAIL_NOT_VERIFIED",
  "OTP_EXPIRED",
  "OTP_ATTEMPTS",
  "TOO_MANY_ATTEMPTS",
] as const

export type SignInErrorCode = (typeof SIGN_IN_ERROR_CODES)[number]

/** What the server may put in `code`: a plain code, or a rate limit carrying its wait in minutes. */
export type SignInErrorCodeValue = Exclude<SignInErrorCode, "TOO_MANY_ATTEMPTS"> | `TOO_MANY_ATTEMPTS:${number}`

/** The code for a sign-in refused by the rate limit, e.g. "TOO_MANY_ATTEMPTS:12". */
export function tooManyAttemptsCode(retryAfterSeconds: number): SignInErrorCodeValue {
  return `TOO_MANY_ATTEMPTS:${Math.max(1, Math.ceil(retryAfterSeconds / 60))}`
}

export type SignInMethod = "password" | "otp"

const CODE_MESSAGES: Record<SignInErrorCode, string> = {
  ACCOUNT_INACTIVE: "Your account has been suspended. Contact support.",
  ACCOUNT_BANNED: "Your account has been suspended. Contact support.",
  EMAIL_NOT_VERIFIED: "Please verify your email before logging in.",
  OTP_EXPIRED: "This code has expired. Request a new one.",
  OTP_ATTEMPTS: "Too many incorrect attempts. Request a new code.",
  TOO_MANY_ATTEMPTS: "Too many attempts. Try again later.",
}

const INVALID_CREDENTIALS: Record<SignInMethod, string> = {
  password: "Invalid email or password.",
  otp: "Invalid OTP. Please try again.",
}

const GENERIC_FAILURE = "We couldn't sign you in. Please try again."

const TOO_MANY_ATTEMPTS = /^TOO_MANY_ATTEMPTS:(\d{1,4})$/

/** Reads a `code` from the server; anything unrecognised is ignored. */
function parseCode(code: string | null | undefined): { code: SignInErrorCode; message: string } | null {
  if (!code) return null
  const limited = TOO_MANY_ATTEMPTS.exec(code)
  if (limited) {
    const minutes = Number(limited[1])
    return { code: "TOO_MANY_ATTEMPTS", message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` }
  }
  if (!(SIGN_IN_ERROR_CODES as readonly string[]).includes(code)) return null
  return { code: code as SignInErrorCode, message: CODE_MESSAGES[code as SignInErrorCode] }
}

/** An error from a sign-in attempt that keeps the server's code for the UI to act on. */
export class SignInFailure extends Error {
  readonly code?: SignInErrorCode

  constructor(message: string, code?: SignInErrorCode) {
    super(message)
    this.name = "SignInFailure"
    this.code = code
  }
}

/**
 * Turns the result of `signIn(..., { redirect: false })` into a SignInFailure, or null when
 * it succeeded. A wrong password and an unknown email read the same.
 */
export function getSignInFailure(
  result: { error?: string | null; code?: string | null; ok?: boolean } | undefined,
  method: SignInMethod,
): SignInFailure | null {
  if (!result) return new SignInFailure(GENERIC_FAILURE)
  if (!result.error) return result.ok === false ? new SignInFailure(GENERIC_FAILURE) : null
  const known = parseCode(result.code)
  if (known) return new SignInFailure(known.message, known.code)
  if (result.error === "CredentialsSignin") return new SignInFailure(INVALID_CREDENTIALS[method])
  return new SignInFailure(GENERIC_FAILURE)
}

/** The banner on /login for an `?error=` (and optional `?code=`) that Auth.js redirected with. */
export function getAuthPageErrorMessage(error: string | null | undefined, code?: string | null): string | null {
  if (!error) return null
  const known = parseCode(code)
  if (known) return known.message
  switch (error) {
    case "CredentialsSignin":
      return INVALID_CREDENTIALS.password
    case "AccessDenied":
      return "This account can't sign in right now. If it has been suspended, contact support."
    case "OAuthAccountNotLinked":
    case "AccountNotLinked":
      return "An account with this email already exists. Sign in with your email and password instead."
    case "Verification":
      return "That sign-in link has expired or was already used. Please sign in again."
    case "OAuthCallbackError":
      return "Sign-in with that provider didn't complete. Please try again or use your email."
    case "MissingCSRF":
      return "Your sign-in form expired. Please try again."
    case "Configuration":
      return "Sign-in is unavailable right now. Please try again in a few minutes."
    default:
      return "An error occurred during sign in. Please try again."
  }
}

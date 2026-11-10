import { describe, it, expect } from "vitest"
import { getSignInFailure, getAuthPageErrorMessage, SignInFailure, tooManyAttemptsCode } from "@/lib/auth-errors"

// The shapes next-auth/react's signIn(..., { redirect: false }) resolves with
const ok = { ok: true, status: 200, error: undefined, code: undefined }
const credentialsSignin = (code: string) => ({ ok: true, status: 200, error: "CredentialsSignin", code })

describe("getSignInFailure", () => {
  it("returns null for a successful sign-in", () => {
    expect(getSignInFailure(ok, "password")).toBeNull()
  })

  it("reads a wrong password and an unknown email the same way", () => {
    const failure = getSignInFailure(credentialsSignin("credentials"), "password")
    expect(failure).toBeInstanceOf(SignInFailure)
    expect(failure?.message).toBe("Invalid email or password.")
    expect(failure?.code).toBeUndefined()
  })

  it("says the code was wrong for an OTP sign-in", () => {
    expect(getSignInFailure(credentialsSignin("credentials"), "otp")?.message).toBe("Invalid OTP. Please try again.")
  })

  it.each([
    ["ACCOUNT_INACTIVE", "Your account has been suspended. Contact support."],
    ["ACCOUNT_BANNED", "Your account has been suspended. Contact support."],
    ["EMAIL_NOT_VERIFIED", "Please verify your email before logging in."],
    ["OTP_EXPIRED", "This code has expired. Request a new one."],
    ["OTP_ATTEMPTS", "Too many incorrect attempts. Request a new code."],
  ])("passes the %s code through with its message", (code, message) => {
    const failure = getSignInFailure(credentialsSignin(code), "password")
    expect(failure?.message).toBe(message)
    expect(failure?.code).toBe(code)
  })

  it("says how long a rate-limited sign-in has to wait", () => {
    const failure = getSignInFailure(credentialsSignin("TOO_MANY_ATTEMPTS:12"), "password")
    expect(failure?.message).toBe("Too many attempts. Try again in 12 minutes.")
    expect(failure?.code).toBe("TOO_MANY_ATTEMPTS")
    expect(getSignInFailure(credentialsSignin("TOO_MANY_ATTEMPTS:1"), "password")?.message).toBe("Too many attempts. Try again in 1 minute.")
    expect(getSignInFailure(credentialsSignin("TOO_MANY_ATTEMPTS:soon"), "password")?.message).toBe("Invalid email or password.")
  })

  it("rounds the wait up to whole minutes", () => {
    expect(tooManyAttemptsCode(900)).toBe("TOO_MANY_ATTEMPTS:15")
    expect(tooManyAttemptsCode(61)).toBe("TOO_MANY_ATTEMPTS:2")
    expect(tooManyAttemptsCode(0)).toBe("TOO_MANY_ATTEMPTS:1")
  })

  it("does not trust an unknown code", () => {
    const failure = getSignInFailure(credentialsSignin("SOMETHING_ELSE"), "password")
    expect(failure?.message).toBe("Invalid email or password.")
    expect(failure?.code).toBeUndefined()
  })

  it("reports a server-side failure as such, not as a wrong password", () => {
    expect(getSignInFailure({ ok: true, error: "Configuration" }, "password")?.message).toBe("We couldn't sign you in. Please try again.")
    expect(getSignInFailure({ ok: false, error: undefined }, "password")?.message).toBe("We couldn't sign you in. Please try again.")
    expect(getSignInFailure(undefined, "password")).toBeInstanceOf(SignInFailure)
  })
})

describe("getAuthPageErrorMessage", () => {
  it("shows nothing without an error", () => {
    expect(getAuthPageErrorMessage(null)).toBeNull()
    expect(getAuthPageErrorMessage("")).toBeNull()
  })

  it("uses the code that came with a CredentialsSignin redirect", () => {
    expect(getAuthPageErrorMessage("CredentialsSignin", "ACCOUNT_BANNED")).toBe("Your account has been suspended. Contact support.")
    expect(getAuthPageErrorMessage("CredentialsSignin", "credentials")).toBe("Invalid email or password.")
    expect(getAuthPageErrorMessage("CredentialsSignin", "TOO_MANY_ATTEMPTS:7")).toBe("Too many attempts. Try again in 7 minutes.")
  })

  it.each([
    ["AccessDenied", /suspended/],
    ["OAuthAccountNotLinked", /already exists/],
    ["OAuthCallbackError", /provider/],
    ["Verification", /expired/],
    ["MissingCSRF", /expired/],
    ["Configuration", /unavailable/],
    ["true", /An error occurred/],
    ["<script>", /An error occurred/],
  ])("has a message for ?error=%s", (error, message) => {
    expect(getAuthPageErrorMessage(error)).toMatch(message)
  })
})

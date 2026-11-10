import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { checkEnv, enforceEnv } from "@/lib/env-check"
import { parseSentryDsn, reportError, shouldSend, _resetErrorReporting } from "@/lib/error-reporting"

const GOOD = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@db:5432/eventflow",
  NEXTAUTH_SECRET: "x".repeat(40),
  TICKET_SECRET: "y".repeat(40),
  NEXT_PUBLIC_APP_URL: "https://eventflow.example.in",
  RESEND_API_KEY: "re_123",
  EMAIL_FROM: "EventFlow <tickets@example.in>",
  CRON_SECRET: "c".repeat(32),
  SENTRY_DSN: "https://abc@o1.ingest.sentry.io/42",
}

describe("startup settings check", () => {
  it("passes a complete production config", () => {
    expect(checkEnv(GOOD)).toEqual([])
    expect(() => enforceEnv(GOOD)).not.toThrow()
  })

  it("stops production when a required secret is missing or too short", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => enforceEnv({ ...GOOD, TICKET_SECRET: "short" })).toThrow(/TICKET_SECRET/)
    expect(() => enforceEnv({ ...GOOD, NEXTAUTH_SECRET: undefined })).toThrow(/NEXTAUTH_SECRET/)
    expect(() => enforceEnv({ ...GOOD, RESEND_API_KEY: undefined })).toThrow(/RESEND_API_KEY/)
    errors.mockRestore()
  })

  it("accepts SMTP instead of Resend and AUTH_SECRET instead of NEXTAUTH_SECRET", () => {
    const env = { ...GOOD, RESEND_API_KEY: undefined, SMTP_HOST: "smtp.example.in", NEXTAUTH_SECRET: undefined, AUTH_SECRET: "z".repeat(40) }
    expect(checkEnv(env).filter((p) => p.level === "required")).toEqual([])
  })

  it("only warns in development", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => enforceEnv({ NODE_ENV: "development" })).not.toThrow()
    errors.mockRestore()
  })

  it("flags half-configured Razorpay and missing webhook secret", () => {
    expect(checkEnv({ ...GOOD, RAZORPAY_KEY_ID: "rzp_test_1" }).map((p) => p.name)).toContain("RAZORPAY_KEY_SECRET")
    const both = checkEnv({ ...GOOD, RAZORPAY_KEY_ID: "rzp_test_1", RAZORPAY_KEY_SECRET: "s" })
    expect(both.find((p) => p.name === "RAZORPAY_WEBHOOK_SECRET")?.level).toBe("recommended")
  })
})

describe("error alerts", () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    _resetErrorReporting()
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("parses a Sentry DSN into its envelope URL", () => {
    expect(parseSentryDsn("https://abc@o1.ingest.sentry.io/42")).toEqual({
      envelopeUrl: "https://o1.ingest.sentry.io/api/42/envelope/", publicKey: "abc", dsn: "https://abc@o1.ingest.sentry.io/42",
    })
    expect(parseSentryDsn("not a dsn")).toBeNull()
    expect(parseSentryDsn(undefined)).toBeNull()
  })

  it("sends to Sentry and the chat webhook, once per 5 minutes for the same error", async () => {
    vi.stubEnv("SENTRY_DSN", "https://abc@o1.ingest.sentry.io/42")
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.slack.com/services/x")
    await reportError(new Error("DB down"), { where: "GET /api/events" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://o1.ingest.sentry.io/api/42/envelope/")
    expect(init.headers["X-Sentry-Auth"]).toContain("sentry_key=abc")
    expect(String(init.body).split("\n")).toHaveLength(3)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).text).toContain("DB down")

    await reportError(new Error("DB down"), { where: "GET /api/events" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("never throws, even when the alert service is down", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.slack.com/services/x")
    fetchMock.mockRejectedValue(new Error("offline"))
    await expect(reportError("boom")).resolves.toBeUndefined()
  })

  it("ignores a webhook that isn't https", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "http://insecure.example")
    await reportError(new Error("x"))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("de-duplicates by key and time", () => {
    expect(shouldSend("k", 0)).toBe(true)
    expect(shouldSend("k", 60_000)).toBe(false)
    expect(shouldSend("k", 6 * 60_000)).toBe(true)
  })
})

describe("plain-text email part", () => {
  it("keeps the words and links, drops tags and styles", async () => {
    const { htmlToText } = await import("@/lib/html-to-text")
    const text = htmlToText(`<style>p{color:red}</style><h2>Payment received</h2><p>You&#39;re going to <b>Demo &amp; Day</b>.</p><p><a href="https://x.in/t/1">Open ticket</a></p>`)
    expect(text).toBe("Payment received\nYou're going to Demo & Day.\nOpen ticket (https://x.in/t/1)")
  })
})

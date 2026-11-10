/**
 * Settings checked when the server starts. In production a missing "required" setting stops
 * the server with a clear message (better than failing on the first sign-in or ticket);
 * "recommended" ones are only warned about.
 */
export interface EnvProblem { name: string; level: "required" | "recommended"; message: string }

type Env = Record<string, string | undefined>

const filled = (v: string | undefined) => typeof v === "string" && v.trim().length > 0

export function checkEnv(env: Env = process.env): EnvProblem[] {
  const problems: EnvProblem[] = []
  const req = (name: string, message: string) => problems.push({ name, level: "required", message })
  const rec = (name: string, message: string) => problems.push({ name, level: "recommended", message })

  if (!filled(env.DATABASE_URL)) req("DATABASE_URL", "The Postgres connection string.")
  const authSecret = env.AUTH_SECRET ?? env.NEXTAUTH_SECRET
  if (!filled(authSecret)) req("NEXTAUTH_SECRET", "Signs sign-in sessions. Generate with: openssl rand -base64 32")
  else if (authSecret!.length < 32) req("NEXTAUTH_SECRET", "Must be at least 32 characters.")
  if (!filled(env.TICKET_SECRET) || env.TICKET_SECRET!.length < 32) req("TICKET_SECRET", "Signs ticket QR codes; at least 32 random characters.")
  if (!filled(env.NEXT_PUBLIC_APP_URL)) req("NEXT_PUBLIC_APP_URL", "The public https:// address, used in emails, tickets and payment callbacks.")
  else if (!/^https:\/\//.test(env.NEXT_PUBLIC_APP_URL!)) rec("NEXT_PUBLIC_APP_URL", "Should start with https:// in production.")

  if (!filled(env.RESEND_API_KEY) && !filled(env.SMTP_HOST)) req("RESEND_API_KEY", "No way to send email (tickets, OTP codes, receipts). Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.")
  if (!filled(env.EMAIL_FROM)) req("EMAIL_FROM", "The sender address, on a domain set up with SPF/DKIM, e.g. EventFlow <tickets@yourdomain.in>.")

  if (!filled(env.CRON_SECRET)) rec("CRON_SECRET", "Needed by the scheduler that releases unpaid seat holds and sends reminders.")
  const rzp = [env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET].filter(filled).length
  if (rzp === 1) req("RAZORPAY_KEY_SECRET", "Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or neither.")
  if (rzp === 2 && !filled(env.RAZORPAY_WEBHOOK_SECRET)) rec("RAZORPAY_WEBHOOK_SECRET", "Without it, a buyer who closes the tab after paying is only confirmed when they come back.")
  if (!filled(env.SENTRY_DSN) && !filled(env.ALERT_WEBHOOK_URL)) rec("SENTRY_DSN", "No error alerts are configured (SENTRY_DSN or ALERT_WEBHOOK_URL).")
  return problems
}

/** Logs the problems; in production throws when a required setting is missing. */
export function enforceEnv(env: Env = process.env) {
  const problems = checkEnv(env)
  for (const p of problems) {
    const line = `[config] ${p.level === "required" ? "MISSING" : "check"} ${p.name}: ${p.message}`
    if (p.level === "required") console.error(line)
    else console.warn(line)
  }
  const missing = problems.filter((p) => p.level === "required")
  if (missing.length && env.NODE_ENV === "production" && env.SKIP_ENV_CHECK !== "1") {
    throw new Error(`EventFlow can't start: missing or invalid settings: ${missing.map((p) => p.name).join(", ")}. See .env.example.`)
  }
}

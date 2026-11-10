/**
 * Error alerts without an extra package. Every error is logged as one JSON line (what the
 * host's log viewer shows); when configured it is also sent to:
 *   - Sentry: SENTRY_DSN (free tier is enough), through Sentry's plain HTTP "store" API.
 *   - A chat webhook: ALERT_WEBHOOK_URL (Slack incoming webhook, Discord webhook, or anything
 *     that accepts {"text": "..."} / {"content": "..."}).
 * The same error is sent at most once per 5 minutes per server, so a crash loop doesn't
 * flood the inbox. Reporting never throws.
 */

const DEDUPE_MS = 5 * 60 * 1000
const recent = new Map<string, number>()

export interface ErrorContext {
  /** Where it happened, e.g. "GET /api/events" or "client: /dashboard/tickets" */
  where?: string
  /** Extra details; never put passwords, tokens or card data here */
  extra?: Record<string, unknown>
  level?: "error" | "warning"
}

interface ParsedDsn { envelopeUrl: string; publicKey: string; dsn: string }

export function parseSentryDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null
  try {
    const u = new URL(dsn)
    const projectId = u.pathname.replace(/^\/+|\/+$/g, "").split("/").pop()
    if (!u.username || !projectId || !/^https?:$/.test(u.protocol)) return null
    const prefix = u.pathname.replace(/\/?[^/]+\/?$/, "")
    return { envelopeUrl: `${u.protocol}//${u.host}${prefix}/api/${projectId}/envelope/`, publicKey: u.username, dsn }
  } catch {
    return null
  }
}

const asError = (e: unknown): Error => (e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e)))

/** Should this error be sent now (not sent in the last 5 minutes)? Exported for tests. */
export function shouldSend(key: string, now = Date.now()): boolean {
  const last = recent.get(key)
  if (last !== undefined && now - last < DEDUPE_MS) return false
  recent.set(key, now)
  if (recent.size > 500) {
    for (const [k, t] of recent) if (now - t >= DEDUPE_MS) recent.delete(k)
  }
  return true
}

/** Clears the de-duplication memory (tests). */
export function _resetErrorReporting() {
  recent.clear()
}

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function reportError(error: unknown, context: ErrorContext = {}): Promise<void> {
  try {
    const err = asError(error)
    const level = context.level ?? "error"
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(), level, message: err.message, where: context.where,
      stack: err.stack?.split("\n").slice(0, 8).join("\n"), ...(context.extra ? { data: context.extra } : {}),
    }))

    const key = `${context.where ?? ""}|${err.name}|${err.message}`.slice(0, 300)
    if (!shouldSend(key)) return

    const env = process.env.NODE_ENV ?? "development"
    const tasks: Promise<unknown>[] = []

    const sentry = parseSentryDsn(process.env.SENTRY_DSN)
    if (sentry) {
      const eventId = crypto.randomUUID().replace(/-/g, "")
      const sentAt = new Date().toISOString()
      const event = {
        event_id: eventId,
        timestamp: sentAt,
        platform: "node",
        level,
        environment: env,
        server_name: process.env.HOSTNAME,
        transaction: context.where,
        exception: { values: [{ type: err.name, value: err.message }] },
        extra: { ...context.extra, stack: err.stack },
      }
      // Sentry's envelope format: a header line, an item header line, then the event
      const envelope = [JSON.stringify({ event_id: eventId, sent_at: sentAt, dsn: sentry.dsn }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n")
      tasks.push(post(sentry.envelopeUrl, envelope, {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=eventflow/1.0, sentry_key=${sentry.publicKey}`,
      }))
    }

    const webhook = process.env.ALERT_WEBHOOK_URL
    if (webhook && /^https:\/\//.test(webhook)) {
      const text = `EventFlow ${level} (${env})${context.where ? ` at ${context.where}` : ""}: ${err.message}`.slice(0, 1800)
      // Slack reads "text", Discord reads "content"
      tasks.push(post(webhook, { text, content: text }))
    }

    await Promise.allSettled(tasks)
  } catch {
    // reporting must never break the request that failed
  }
}

import Redis from "ioredis"

/**
 * Fixed-window rate limiting.
 *
 * By default counts live in this process's memory, which is right for a single app server.
 * Set REDIS_URL and every server shares its counts through Redis instead (one INCR per
 * request, made atomic with a small Lua script). When Redis errors or is slow, that one call
 * falls back to the in-memory counts, so a Redis outage never fails a request; the first
 * failure is logged.
 */

interface RateLimitRecord {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

/** The ioredis calls the shared store uses (an ioredis client satisfies it). */
export interface RateLimitRedis {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>
  del(...keys: string[]): Promise<number>
}

class MemoryStore {
  private store = new Map<string, RateLimitRecord>()

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now()
    const record = this.store.get(key)

    if (!record || now > record.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs })
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
    }

    if (record.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt,
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      }
    }

    record.count++
    return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt }
  }

  peek(key: string, limit: number): RateLimitResult {
    const now = Date.now()
    const record = this.store.get(key)
    if (!record || now > record.resetAt) return { allowed: true, remaining: limit, resetAt: now }
    if (record.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: record.resetAt, retryAfter: Math.ceil((record.resetAt - now) / 1000) }
    }
    return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt }
  }

  reset(key: string) {
    this.store.delete(key)
  }

  hold(key: string, ms: number) {
    const record = this.store.get(key)
    if (record) record.resetAt = Math.max(record.resetAt, Date.now() + ms)
  }

  cleanup() {
    const now = Date.now()
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetAt) this.store.delete(key)
    }
  }
}

// KEYS[1] = counter. ARGV[1] = limit, ARGV[2] = window ms. Returns {allowed 0|1, count, pttl}.
// Like the memory store, a call that is already over the limit is not counted.
export const CHECK_SCRIPT = `
local c = tonumber(redis.call('GET', KEYS[1]) or '0')
local ttl = redis.call('PTTL', KEYS[1])
if c > 0 and ttl > 0 and c >= tonumber(ARGV[1]) then return {0, c, ttl} end
if ttl <= 0 then c = 0; redis.call('DEL', KEYS[1]) end
c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  ttl = tonumber(ARGV[2])
end
return {1, c, ttl}
`

// KEYS[1] = counter. Returns {count, pttl}; count 0 when the key is gone.
export const PEEK_SCRIPT = `
local c = tonumber(redis.call('GET', KEYS[1]) or '0')
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return {0, 0} end
return {c, ttl}
`

// KEYS[1] = counter, ARGV[1] = ms. Extends the expiry to at least ms from now (never shortens).
export const HOLD_SCRIPT = `
local ttl = redis.call('PTTL', KEYS[1])
if ttl == -2 then return 0 end
if ttl < tonumber(ARGV[1]) then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return 1
`

const DEFAULT_PREFIX = "evf:rl:"
const DEFAULT_TIMEOUT_MS = 500

export interface RateLimiterOptions {
  /** Returns the shared Redis client, or null to count in memory. Called on every operation. */
  redis?: () => RateLimitRedis | null
  /** Prepended to every Redis key. */
  prefix?: string
  /** A Redis call slower than this falls back to memory. */
  timeoutMs?: number
}

export class RateLimiter {
  private memory = new MemoryStore()
  private getRedis: () => RateLimitRedis | null
  private prefix: string
  private timeoutMs: number
  private warned = false

  constructor(options: RateLimiterOptions = {}) {
    this.getRedis = options.redis ?? (() => null)
    this.prefix = options.prefix ?? DEFAULT_PREFIX
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  /** Count one call against `key`; allowed while fewer than `limit` calls fell in the window. */
  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    return this.shared(
      async (redis) => {
        const [ok, count, ttl] = toNumbers(await redis.eval(CHECK_SCRIPT, 1, this.prefix + key, limit, windowMs))
        const now = Date.now()
        const resetAt = now + ttl
        if (!ok) return { allowed: false, remaining: 0, resetAt, retryAfter: Math.ceil(ttl / 1000) }
        return { allowed: true, remaining: limit - count, resetAt }
      },
      () => this.memory.check(key, limit, windowMs)
    )
  }

  /** Whether `key` is still under `limit`, without counting this call against it. */
  async peek(key: string, limit: number): Promise<RateLimitResult> {
    return this.shared(
      async (redis) => {
        const [count, ttl] = toNumbers(await redis.eval(PEEK_SCRIPT, 1, this.prefix + key))
        const now = Date.now()
        if (count === 0) return { allowed: true, remaining: limit, resetAt: now }
        const resetAt = now + ttl
        if (count >= limit) return { allowed: false, remaining: 0, resetAt, retryAfter: Math.ceil(ttl / 1000) }
        return { allowed: true, remaining: limit - count, resetAt }
      },
      () => this.memory.peek(key, limit)
    )
  }

  /** Forget everything counted against `key`. */
  async reset(key: string): Promise<void> {
    // Clear the memory copy too, in case earlier calls fell back to it.
    this.memory.reset(key)
    await this.shared(
      async (redis) => {
        await redis.del(this.prefix + key)
      },
      () => undefined
    )
  }

  /** Keep what `key` has counted for at least `ms` from now (a lockout that starts at the last attempt). */
  async hold(key: string, ms: number): Promise<void> {
    await this.shared(
      async (redis) => {
        await redis.eval(HOLD_SCRIPT, 1, this.prefix + key, ms)
      },
      () => this.memory.hold(key, ms)
    )
  }

  /** Drop expired in-memory entries (Redis expires its own keys). */
  cleanup() {
    this.memory.cleanup()
  }

  private async shared<T>(viaRedis: (redis: RateLimitRedis) => Promise<T>, inMemory: () => T): Promise<T> {
    let redis: RateLimitRedis | null = null
    try {
      redis = this.getRedis()
    } catch (error) {
      this.warnOnce(error)
    }
    if (!redis) return inMemory()

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        viaRedis(redis),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Redis did not answer within ${this.timeoutMs}ms`)), this.timeoutMs)
        }),
      ])
    } catch (error) {
      this.warnOnce(error)
      return inMemory()
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private warnOnce(error: unknown) {
    if (this.warned) return
    this.warned = true
    console.error("[rate-limiter] Redis unavailable; counting in this server's memory until it answers again:", error)
  }
}

function toNumbers(reply: unknown): number[] {
  if (!Array.isArray(reply)) throw new Error("Unexpected Redis reply")
  return reply.map((v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) throw new Error("Unexpected Redis reply")
    return n
  })
}

// One client per process, created on first use and only when REDIS_URL is set (so the
// default single-server setup never opens a connection).
const globalForRateLimit = globalThis as unknown as { rateLimitRedis?: Redis }

function sharedRedisFromEnv(): RateLimitRedis | null {
  const url = process.env.REDIS_URL
  if (!url) return null
  if (!globalForRateLimit.rateLimitRedis) {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    })
    // Errors surface on the calls (and fall back); without a listener ioredis would log every reconnect.
    client.on("error", () => {})
    globalForRateLimit.rateLimitRedis = client
  }
  return globalForRateLimit.rateLimitRedis
}

export const rateLimiter = new RateLimiter({ redis: sharedRedisFromEnv })

// Cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000)
  if (typeof timer === "object" && timer && "unref" in timer) timer.unref()
}

// Rate limit configurations
export const RATE_LIMITS = {
  auth: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
  // Failed password sign-ins from one IP, across all emails. Larger than `auth` because a
  // campus or office network puts many people behind one address.
  authPerIp: { limit: 100, windowMs: 15 * 60 * 1000 },
  api: { limit: 60, windowMs: 60 * 1000 }, // 60 per min
  upload: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  contact: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  registration: { limit: 10, windowMs: 60 * 1000 }, // 10 per min
  dataExport: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour per account ("Download my data")
} as const

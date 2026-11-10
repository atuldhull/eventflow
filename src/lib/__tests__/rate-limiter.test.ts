import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { randomUUID } from "crypto"
import {
  RateLimiter,
  CHECK_SCRIPT,
  PEEK_SCRIPT,
  HOLD_SCRIPT,
  type RateLimitRedis,
} from "@/lib/rate-limiter"

/** An in-process stand-in for the Redis commands the scripts use, on vitest's fake clock. */
class FakeRedis implements RateLimitRedis {
  data = new Map<string, { value: number; expiresAt: number | null }>()
  calls: string[] = []
  failing = false

  private live(key: string) {
    const entry = this.data.get(key)
    if (entry && entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this.data.delete(key)
      return undefined
    }
    return entry
  }

  private pttl(key: string) {
    const entry = this.live(key)
    if (!entry) return -2
    return entry.expiresAt === null ? -1 : entry.expiresAt - Date.now()
  }

  async eval(script: string, _numKeys: number, ...args: (string | number)[]): Promise<unknown> {
    if (this.failing) throw new Error("ECONNREFUSED")
    const key = String(args[0])
    if (script === CHECK_SCRIPT) {
      this.calls.push(`check ${key}`)
      const [limit, windowMs] = [Number(args[1]), Number(args[2])]
      let entry = this.live(key)
      const ttl = this.pttl(key)
      if (entry && ttl > 0 && entry.value >= limit) return [0, entry.value, ttl]
      if (!entry || ttl <= 0) {
        entry = { value: 0, expiresAt: null }
        this.data.set(key, entry)
      }
      entry.value++
      if (entry.value === 1) entry.expiresAt = Date.now() + windowMs
      return [1, entry.value, this.pttl(key)]
    }
    if (script === PEEK_SCRIPT) {
      this.calls.push(`peek ${key}`)
      const entry = this.live(key)
      const ttl = this.pttl(key)
      return entry && ttl > 0 ? [entry.value, ttl] : [0, 0]
    }
    if (script === HOLD_SCRIPT) {
      this.calls.push(`hold ${key}`)
      const entry = this.live(key)
      if (!entry) return 0
      const ms = Number(args[1])
      if (this.pttl(key) < ms) entry.expiresAt = Date.now() + ms
      return 1
    }
    throw new Error("unknown script")
  }

  async del(...keys: string[]): Promise<number> {
    if (this.failing) throw new Error("ECONNREFUSED")
    this.calls.push(`del ${keys.join(" ")}`)
    let n = 0
    for (const k of keys) if (this.data.delete(k)) n++
    return n
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// The same scenarios run against both stores, so Redis mode keeps memory mode's semantics.
describe.each([
  ["memory", () => ({ limiter: new RateLimiter(), redis: null as FakeRedis | null })],
  [
    "redis",
    () => {
      const redis = new FakeRedis()
      return { limiter: new RateLimiter({ redis: () => redis }), redis: redis as FakeRedis | null }
    },
  ],
])("RateLimiter (%s store)", (_name, make) => {
  it("allows `limit` calls per window, then blocks with retryAfter", async () => {
    const { limiter } = make()
    for (let i = 1; i <= 3; i++) {
      const r = await limiter.check("k", 3, 60_000)
      expect(r).toMatchObject({ allowed: true, remaining: 3 - i })
    }
    const blocked = await limiter.check("k", 3, 60_000)
    expect(blocked).toMatchObject({ allowed: false, remaining: 0, retryAfter: 60 })
    expect(blocked.resetAt).toBe(Date.now() + 60_000)
  })

  it("starts a new window once the old one expires", async () => {
    const { limiter } = make()
    await limiter.check("k", 1, 1_000)
    expect((await limiter.check("k", 1, 1_000)).allowed).toBe(false)
    vi.advanceTimersByTime(1_001)
    expect(await limiter.check("k", 1, 1_000)).toMatchObject({ allowed: true, remaining: 0 })
  })

  it("keeps keys separate", async () => {
    const { limiter } = make()
    await limiter.check("a", 1, 1_000)
    expect((await limiter.check("a", 1, 1_000)).allowed).toBe(false)
    expect((await limiter.check("b", 1, 1_000)).allowed).toBe(true)
  })

  it("peek reports without counting", async () => {
    const { limiter } = make()
    expect(await limiter.peek("k", 2)).toMatchObject({ allowed: true, remaining: 2 })
    await limiter.check("k", 2, 10_000)
    expect(await limiter.peek("k", 2)).toMatchObject({ allowed: true, remaining: 1 })
    expect(await limiter.peek("k", 2)).toMatchObject({ allowed: true, remaining: 1 })
    await limiter.check("k", 2, 10_000)
    expect(await limiter.peek("k", 2)).toMatchObject({ allowed: false, remaining: 0, retryAfter: 10 })
  })

  it("reset forgets the key", async () => {
    const { limiter } = make()
    await limiter.check("k", 1, 10_000)
    await limiter.reset("k")
    expect((await limiter.check("k", 1, 10_000)).allowed).toBe(true)
  })

  it("hold extends the window from now, never shortens it", async () => {
    const { limiter } = make()
    await limiter.check("k", 1, 10_000)
    vi.advanceTimersByTime(8_000)
    await limiter.hold("k", 10_000) // now ends 10s from here, not 2s
    vi.advanceTimersByTime(5_000)
    expect((await limiter.peek("k", 1)).allowed).toBe(false)
    await limiter.hold("k", 1_000) // shorter: no change
    vi.advanceTimersByTime(2_000)
    expect((await limiter.peek("k", 1)).allowed).toBe(false)
    vi.advanceTimersByTime(3_001)
    expect((await limiter.peek("k", 1)).allowed).toBe(true)
  })

  it("hold on an unknown key does nothing", async () => {
    const { limiter } = make()
    await limiter.hold("nope", 10_000)
    expect(await limiter.peek("nope", 1)).toMatchObject({ allowed: true, remaining: 1 })
  })
})

describe("RateLimiter Redis mode", () => {
  it("shares counts between limiters (servers) and prefixes keys", async () => {
    const redis = new FakeRedis()
    const serverA = new RateLimiter({ redis: () => redis, prefix: "t:" })
    const serverB = new RateLimiter({ redis: () => redis, prefix: "t:" })
    await serverA.check("login", 2, 60_000)
    await serverB.check("login", 2, 60_000)
    expect((await serverA.check("login", 2, 60_000)).allowed).toBe(false)
    expect([...redis.data.keys()]).toEqual(["t:login"])
    await serverB.reset("login")
    expect(redis.calls).toContain("del t:login")
    expect((await serverA.check("login", 2, 60_000)).allowed).toBe(true)
  })

  it("does not count calls made while blocked", async () => {
    const redis = new FakeRedis()
    const limiter = new RateLimiter({ redis: () => redis })
    await limiter.check("k", 1, 60_000)
    await limiter.check("k", 1, 60_000)
    await limiter.check("k", 1, 60_000)
    expect(redis.data.get("evf:rl:k")?.value).toBe(1)
  })

  it("falls back to memory when Redis errors, logging once", async () => {
    const redis = new FakeRedis()
    redis.failing = true
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const limiter = new RateLimiter({ redis: () => redis })
    expect((await limiter.check("k", 2, 60_000)).allowed).toBe(true)
    expect((await limiter.check("k", 2, 60_000)).allowed).toBe(true)
    expect((await limiter.check("k", 2, 60_000)).allowed).toBe(false) // memory still enforces
    expect((await limiter.peek("k", 2)).allowed).toBe(false)
    await limiter.hold("k", 1_000)
    await expect(limiter.reset("k")).resolves.toBeUndefined()
    expect((await limiter.check("k", 2, 60_000)).allowed).toBe(true)
    expect(error).toHaveBeenCalledTimes(1)
  })

  it("falls back to memory when Redis does not answer in time", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const hung: RateLimitRedis = { eval: () => new Promise(() => {}), del: () => new Promise(() => {}) }
    const limiter = new RateLimiter({ redis: () => hung, timeoutMs: 100 })
    const pending = limiter.check("k", 1, 60_000)
    await vi.advanceTimersByTimeAsync(100)
    expect(await pending).toMatchObject({ allowed: true, remaining: 0 })
    expect(error).toHaveBeenCalledTimes(1)
  })

  it("falls back to memory when the client cannot be created", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const limiter = new RateLimiter({
      redis: () => {
        throw new Error("bad REDIS_URL")
      },
    })
    expect((await limiter.check("k", 1, 60_000)).allowed).toBe(true)
    expect((await limiter.check("k", 1, 60_000)).allowed).toBe(false)
  })

  it("treats an unexpected reply as an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const odd: RateLimitRedis = { eval: async () => "OK", del: async () => 0 }
    const limiter = new RateLimiter({ redis: () => odd })
    expect(await limiter.check("k", 1, 60_000)).toMatchObject({ allowed: true, remaining: 0 })
  })
})

describe("default rateLimiter", () => {
  it("counts in memory and never touches Redis when REDIS_URL is unset", async () => {
    const original = process.env.REDIS_URL
    delete process.env.REDIS_URL
    try {
      vi.resetModules()
      const ioredis = vi.fn()
      vi.doMock("ioredis", () => ({ default: ioredis }))
      const { rateLimiter } = await import("@/lib/rate-limiter")
      const key = `default-${randomUUID()}`
      expect((await rateLimiter.check(key, 1, 60_000)).allowed).toBe(true)
      expect((await rateLimiter.check(key, 1, 60_000)).allowed).toBe(false)
      await rateLimiter.reset(key)
      expect(ioredis).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock("ioredis")
      vi.resetModules()
      if (original !== undefined) process.env.REDIS_URL = original
    }
  })
})

// Runs the real Lua scripts against a real Redis. Opt-in: REDIS_INTEGRATION_URL=redis://...
// Keys use a unique "evf-test:" prefix and are deleted afterwards; nothing is flushed.
describe.skipIf(!process.env.REDIS_INTEGRATION_URL)("RateLimiter against a real Redis", () => {
  it("counts, blocks, holds and resets", async () => {
    vi.useRealTimers()
    const { default: Redis } = await import("ioredis")
    const client = new Redis(process.env.REDIS_INTEGRATION_URL!, { maxRetriesPerRequest: 1 })
    client.on("error", () => {})
    const prefix = `evf-test:${randomUUID()}:`
    try {
      const a = new RateLimiter({ redis: () => client, prefix, timeoutMs: 2_000 })
      const b = new RateLimiter({ redis: () => client, prefix, timeoutMs: 2_000 })
      expect(await a.check("k", 2, 5_000)).toMatchObject({ allowed: true, remaining: 1 })
      expect(await b.check("k", 2, 5_000)).toMatchObject({ allowed: true, remaining: 0 })
      const blocked = await a.check("k", 2, 5_000)
      expect(blocked).toMatchObject({ allowed: false, remaining: 0 })
      expect(blocked.retryAfter).toBeGreaterThan(0)
      expect(await client.get(`${prefix}k`)).toBe("2") // the blocked call was not counted
      expect((await b.peek("k", 2)).allowed).toBe(false)

      await a.hold("k", 60_000)
      expect(await client.pttl(`${prefix}k`)).toBeGreaterThan(50_000)
      await a.hold("k", 1_000)
      expect(await client.pttl(`${prefix}k`)).toBeGreaterThan(50_000)

      await b.reset("k")
      expect(await client.exists(`${prefix}k`)).toBe(0)
      expect(await a.peek("k", 2)).toMatchObject({ allowed: true, remaining: 2 })

      await a.check("short", 1, 200)
      await new Promise((r) => setTimeout(r, 300))
      expect((await a.check("short", 1, 200)).allowed).toBe(true)
    } finally {
      const keys = await client.keys(`${prefix}*`)
      if (keys.length) await client.del(...keys)
      client.disconnect()
    }
  })
})

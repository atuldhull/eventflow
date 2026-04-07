interface RateLimitRecord {
  count: number
  resetAt: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

class RateLimiter {
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

  // Cleanup expired entries periodically
  cleanup() {
    const now = Date.now()
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetAt) this.store.delete(key)
    }
  }
}

export const rateLimiter = new RateLimiter()

// Cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000)
}

// Rate limit configurations
export const RATE_LIMITS = {
  auth: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
  api: { limit: 60, windowMs: 60 * 1000 }, // 60 per min
  upload: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  contact: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  registration: { limit: 10, windowMs: 60 * 1000 }, // 10 per min
} as const

class MemoryCache {
  private cache = new Map<string, { value: unknown; expiresAt: number }>()

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    return true
  }
}

export const cache = new MemoryCache()

// Cleanup expired entries every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of (cache as any).cache.entries()) {
      if (now > entry.expiresAt) (cache as any).cache.delete(key)
    }
  }, 10 * 60 * 1000)
}

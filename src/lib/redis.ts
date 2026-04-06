import Redis from "ioredis"

function getRedisClient() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000)
      return delay
    },
  })

  redis.on("error", (error) => {
    console.error("Redis connection error:", error)
  })

  redis.on("connect", () => {
    console.log("Redis connected successfully")
  })

  return redis
}

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

export const redis = globalForRedis.redis ?? getRedisClient()

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis

export default redis

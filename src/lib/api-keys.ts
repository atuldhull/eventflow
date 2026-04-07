import crypto from "crypto"
import prisma from "@/lib/prisma"

const KEY_PREFIX = "evf_live_"

function generateRandomString(length: number): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars[crypto.randomInt(chars.length)]
  }
  return result
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

export async function generateApiKey(params: {
  name: string
  organizationId?: string
  enterpriseId?: string
  createdById: string
  scopes: string[]
  expiresAt?: Date
  rateLimit?: number
}) {
  const rawKey = KEY_PREFIX + generateRandomString(32)
  const hashedKey = hashKey(rawKey)
  const prefix = rawKey.slice(0, 12)

  const apiKey = await prisma.apiKey.create({
    data: {
      name: params.name,
      key: hashedKey, // Store hash, not raw key
      hashedKey,
      prefix,
      organizationId: params.organizationId,
      enterpriseId: params.enterpriseId,
      createdById: params.createdById,
      scopes: params.scopes,
      expiresAt: params.expiresAt,
      rateLimit: params.rateLimit || 100,
    },
  })

  return { id: apiKey.id, key: rawKey, prefix, name: apiKey.name, scopes: apiKey.scopes }
}

export async function validateApiKey(key: string) {
  const hashedKey = hashKey(key)

  const apiKey = await prisma.apiKey.findFirst({
    where: { hashedKey },
    select: {
      id: true, name: true, scopes: true, isActive: true, expiresAt: true,
      rateLimit: true, requestCount: true, organizationId: true, enterpriseId: true,
    },
  })

  if (!apiKey) return { valid: false, error: "Invalid API key" }
  if (!apiKey.isActive) return { valid: false, error: "API key has been revoked" }
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) return { valid: false, error: "API key expired" }

  // Update last used
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date(), requestCount: { increment: 1 } },
  })

  return { valid: true, apiKey }
}

export function checkScope(scopes: string[], required: string): boolean {
  if (scopes.includes(required)) return true
  // Write includes read
  const [resource, action] = required.split(":")
  if (action === "read" && scopes.includes(`${resource}:write`)) return true
  return false
}

export async function revokeApiKey(keyId: string) {
  return prisma.apiKey.update({ where: { id: keyId }, data: { isActive: false } })
}

export async function listApiKeys(organizationId?: string, enterpriseId?: string) {
  return prisma.apiKey.findMany({
    where: { ...(organizationId ? { organizationId } : {}), ...(enterpriseId ? { enterpriseId } : {}) },
    select: {
      id: true, name: true, prefix: true, scopes: true, isActive: true,
      lastUsedAt: true, expiresAt: true, rateLimit: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })
}

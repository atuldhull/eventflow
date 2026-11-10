import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { normalizePlatformSettings, type PlatformSettings } from "@/lib/platform-settings"

/*
 * There is no dedicated settings table, so the platform settings document is kept as ONE
 * row of FeatureModuleData (no tenant ids, a fixed uniqueKey). Every tenant-facing reader of
 * that table filters by its own moduleId and organization/enterprise/event, so this row is
 * never listed to a tenant.
 */
const SETTINGS_KEY = "platform:settings"
const SETTINGS_MODULE = "platform"
const SETTINGS_TYPE = "PLATFORM_SETTINGS"

export async function getPlatformSettings(): Promise<{ settings: PlatformSettings; updatedAt: Date | null }> {
  const row = await prisma.featureModuleData.findUnique({
    where: { uniqueKey: SETTINGS_KEY },
    select: { data: true, updatedAt: true },
  })
  return { settings: normalizePlatformSettings(row?.data), updatedAt: row?.updatedAt ?? null }
}

/*
 * The settings that change what the app does (sign-ups, sign-in providers, payments,
 * certificates, maintenance, password length) are read on hot paths, the middleware
 * included, so readers use this copy, refreshed at most every 30 seconds per server process.
 * A save takes effect here at once and in other processes within the TTL.
 */
const CACHE_TTL_MS = 30_000
// On globalThis, not a module variable: the bundler can load this module more than once
// in one process (per route / middleware), and a save must clear every copy's view, or
// e.g. sign-up keeps the old minimum password length for up to 30 s after a change.
const store = globalThis as typeof globalThis & { __evfPlatformSettings?: { settings: PlatformSettings; at: number } | null }

export async function getActivePlatformSettings(): Promise<PlatformSettings> {
  const cached = store.__evfPlatformSettings
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.settings
  const { settings } = await getPlatformSettings()
  store.__evfPlatformSettings = { settings, at: Date.now() }
  return settings
}

export async function savePlatformSettings(settings: PlatformSettings, userId: string): Promise<void> {
  store.__evfPlatformSettings = null
  const data = settings as unknown as Prisma.InputJsonValue
  await prisma.featureModuleData.upsert({
    where: { uniqueKey: SETTINGS_KEY },
    create: {
      uniqueKey: SETTINGS_KEY,
      moduleId: SETTINGS_MODULE,
      dataType: SETTINGS_TYPE,
      title: "Platform settings",
      data,
      isPublished: false,
      createdById: userId,
      updatedById: userId,
    },
    update: { data, updatedById: userId },
  })
}

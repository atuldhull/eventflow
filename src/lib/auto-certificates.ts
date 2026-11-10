import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { asObject } from "@/lib/org-settings"
import { generateBulkCertificates } from "@/lib/certificate"
import { getPlatformSettings } from "@/lib/platform-settings-store"

/**
 * "Auto-generate certificates": the organization's Event defaults switch
 * (Organization.settings.eventDefaults.autoGenerateCertificates) or the enterprise's
 * (Enterprise.settings.autoGenerateCertificates, for every organization in a live
 * enterprise). Either one turns it on for an organization's events.
 */
export function wantsAutoCertificates(
  orgSettings: unknown,
  enterprise: { settings: unknown; isActive: boolean; deletedAt: Date | null } | null | undefined
): boolean {
  if (asObject(asObject(orgSettings).eventDefaults).autoGenerateCertificates === true) return true
  return !!enterprise && enterprise.isActive && !enterprise.deletedAt && asObject(enterprise.settings).autoGenerateCertificates === true
}

const MARK = "autoCertificatesIssuedAt"
const LOOKBACK_DAYS = 30

/**
 * Issues PARTICIPATION certificates, with the organization's default template, to the
 * checked-in attendees of events that ended in the last 30 days, where auto-generation is
 * on. Each event is done once (event.settings.autoCertificatesIssuedAt); an event whose
 * organization has no template yet is retried on a later run. Existing certificates are
 * skipped (generateCertificate), so a manual run before this one is never duplicated.
 * Nothing is issued while the platform's "Certificate generation" feature is off.
 * Called by the hourly cron (/api/cron/reminders).
 */
export async function issueAutomaticCertificates(now = new Date()) {
  const { settings: platform } = await getPlatformSettings()
  if (!platform.features.certificateGeneration) return { events: 0, generated: 0, disabled: true }

  const events = await prisma.event.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["DRAFT", "PENDING_APPROVAL", "CANCELLED", "POSTPONED"] },
      endDate: { lt: now, gte: new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
      organization: { isActive: true, deletedAt: null },
      // not done yet: the mark is missing (or the settings are empty)
      settings: { path: [MARK], equals: Prisma.AnyNull },
    },
    orderBy: { endDate: "asc" },
    take: 100,
    select: {
      id: true,
      settings: true,
      organizationId: true,
      organization: { select: { settings: true, enterprise: { select: { settings: true, isActive: true, deletedAt: true } } } },
    },
  })

  let processed = 0
  let generated = 0
  for (const event of events) {
    if (!event.organizationId || !wantsAutoCertificates(event.organization?.settings, event.organization?.enterprise)) continue
    const template = await prisma.certificateTemplate.findFirst({
      where: { organizationId: event.organizationId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    })
    if (!template) continue

    try {
      const result = await generateBulkCertificates({ eventId: event.id, templateId: template.id, recipientFilter: "checked_in_only" })
      generated += result.generated
      processed++
      await prisma.event.update({
        where: { id: event.id },
        data: { settings: { ...asObject(event.settings), [MARK]: now.toISOString() } as Prisma.InputJsonObject },
      })
    } catch (error) {
      console.error(`Automatic certificates failed for event ${event.id}:`, error)
    }
  }
  return { events: processed, generated, disabled: false }
}

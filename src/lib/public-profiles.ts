import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import {
  LISTED_EVENT_STATUSES,
  PUBLIC_EVENT_CARD_SELECT,
  UPCOMING_EVENT_STATUSES,
  publicListingWhere,
  serializeEventCard,
} from "@/lib/public-events"

/**
 * Public organization and enterprise profiles (/org/[slug], /enterprise/[slug] and
 * /api/public/*). Only what the organization chose to publish: name, logo, description,
 * website, location, social links, PUBLIC events and simple counts. Never the contact
 * email or phone, the address, internal ids, settings or anything about members beyond
 * a count.
 */

export const PUBLIC_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/i

export const UPCOMING_LIMIT = 12
export const PAST_LIMIT = 6

export interface PublicLink {
  href: string
  label: string
}

/** A website as an http(s) link, or null. "example.com" becomes https://example.com. */
export function safeExternalUrl(value: unknown): PublicLink | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw || raw.length > 500) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (!url.hostname.includes(".")) return null
    const label = `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`.replace(/\/$/, "")
    return { href: url.href, label }
  } catch {
    return null
  }
}

/** An image source the page may render: an http(s) URL or a site path like /uploads/logo.png. */
export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== "string") return null
  const src = value.trim()
  if (!src || src.length > 1000) return null
  if (src.startsWith("/") && !src.startsWith("//")) return src
  try {
    const url = new URL(src)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null
  } catch {
    return null
  }
}

const SOCIAL_LABELS: Record<string, string> = {
  twitter: "X (Twitter)",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  github: "GitHub",
  discord: "Discord",
  website: "Website",
}

/** socialLinks JSON ({ twitter: "https://…" }) as safe links; anything else is dropped. */
export function publicSocialLinks(value: unknown): PublicLink[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const links: PublicLink[] = []
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const link = safeExternalUrl(raw)
    if (!link) continue
    const name = SOCIAL_LABELS[key.toLowerCase()] ?? key.charAt(0).toUpperCase() + key.slice(1)
    links.push({ href: link.href, label: name.slice(0, 40) })
    if (links.length >= 8) break
  }
  return links
}

const location = (parts: (string | null | undefined)[]) => parts.map((p) => p?.trim()).filter(Boolean).join(", ") || null

/** "TECHNICAL" -> "Technical", "TEAM_BUILDING" -> "Team building" */
export function categoryLabel(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  const words = v.replace(/_/g, " ").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Upcoming = not ended and not completed; past = completed or ended. The two never overlap. */
function upcomingWhere(scope: Prisma.EventWhereInput, now: Date): Prisma.EventWhereInput {
  return { AND: [publicListingWhere(UPCOMING_EVENT_STATUSES), scope, { endDate: { gte: now } }] }
}
function pastWhere(scope: Prisma.EventWhereInput, now: Date): Prisma.EventWhereInput {
  return {
    AND: [publicListingWhere(LISTED_EVENT_STATUSES), scope, { OR: [{ status: "COMPLETED" }, { endDate: { lt: now } }] }],
  }
}

async function eventLists(scope: Prisma.EventWhereInput, now: Date) {
  const upcoming = upcomingWhere(scope, now)
  const past = pastWhere(scope, now)
  const [upcomingEvents, pastEvents, upcomingCount, pastCount] = await Promise.all([
    prisma.event.findMany({ where: upcoming, orderBy: { startDate: "asc" }, take: UPCOMING_LIMIT, select: PUBLIC_EVENT_CARD_SELECT }),
    prisma.event.findMany({ where: past, orderBy: { startDate: "desc" }, take: PAST_LIMIT, select: PUBLIC_EVENT_CARD_SELECT }),
    prisma.event.count({ where: upcoming }),
    prisma.event.count({ where: past }),
  ])
  return {
    upcomingEvents: upcomingEvents.map((e) => serializeEventCard(e, now)),
    pastEvents: pastEvents.map((e) => serializeEventCard(e, now)),
    upcomingCount,
    pastCount,
  }
}

export type PublicEventCard = ReturnType<typeof serializeEventCard<Prisma.EventGetPayload<{ select: typeof PUBLIC_EVENT_CARD_SELECT }>>>

export interface PublicOrganizationProfile {
  kind: "organization"
  name: string
  slug: string
  description: string | null
  logo: string | null
  website: PublicLink | null
  location: string | null
  category: string | null
  isVerified: boolean
  socialLinks: PublicLink[]
  enterprise: { name: string; slug: string } | null
  counts: { upcomingEvents: number; pastEvents: number; members: number }
  upcomingEvents: PublicEventCard[]
  pastEvents: PublicEventCard[]
}

export interface PublicEnterpriseProfile {
  kind: "enterprise"
  name: string
  slug: string
  description: string | null
  logo: string | null
  website: PublicLink | null
  location: string | null
  type: string | null
  isVerified: boolean
  socialLinks: PublicLink[]
  organizations: { name: string; slug: string; logo: string | null; category: string | null; upcomingEvents: number }[]
  counts: { organizations: number; upcomingEvents: number; pastEvents: number; members: number }
  upcomingEvents: PublicEventCard[]
  pastEvents: PublicEventCard[]
}

/** An active organization's public profile, or null for an unknown, inactive or deleted one. */
export async function getPublicOrganization(slug: string, now: Date = new Date()): Promise<PublicOrganizationProfile | null> {
  if (!PUBLIC_SLUG_PATTERN.test(slug)) return null
  const org = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    select: {
      id: true, name: true, slug: true, description: true, logo: true, website: true,
      city: true, state: true, country: true, category: true, isVerified: true, socialLinks: true,
      enterprise: { select: { name: true, slug: true, isActive: true, deletedAt: true } },
    },
  })
  if (!org) return null
  // an organization of a deactivated or deleted enterprise is off the public site with it
  if (org.enterprise && (!org.enterprise.isActive || org.enterprise.deletedAt)) return null

  const [lists, members] = await Promise.all([
    eventLists({ organizationId: org.id }, now),
    prisma.organizationMember.count({ where: { organizationId: org.id, isActive: true } }),
  ])

  const ent = org.enterprise
  return {
    kind: "organization",
    name: org.name,
    slug: org.slug,
    description: org.description?.trim() || null,
    logo: safeImageSrc(org.logo),
    website: safeExternalUrl(org.website),
    location: location([org.city, org.state, org.country]),
    category: categoryLabel(org.category),
    isVerified: org.isVerified,
    socialLinks: publicSocialLinks(org.socialLinks),
    enterprise: ent && ent.isActive && !ent.deletedAt ? { name: ent.name, slug: ent.slug } : null,
    counts: { upcomingEvents: lists.upcomingCount, pastEvents: lists.pastCount, members },
    upcomingEvents: lists.upcomingEvents,
    pastEvents: lists.pastEvents,
  }
}

/** An active enterprise's public profile, or null for an unknown, inactive or deleted one. */
export async function getPublicEnterprise(slug: string, now: Date = new Date()): Promise<PublicEnterpriseProfile | null> {
  if (!PUBLIC_SLUG_PATTERN.test(slug)) return null
  const ent = await prisma.enterprise.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    select: {
      id: true, name: true, slug: true, description: true, logo: true, website: true,
      city: true, state: true, country: true, type: true, isVerified: true, socialLinks: true,
    },
  })
  if (!ent) return null

  const activeOrg = { isActive: true, deletedAt: null } satisfies Prisma.OrganizationWhereInput
  // The enterprise's own events and those of its active organizations
  const scope: Prisma.EventWhereInput = {
    OR: [
      { enterpriseId: ent.id, OR: [{ organizationId: null }, { organization: activeOrg }] },
      { organization: { ...activeOrg, enterpriseId: ent.id } },
    ],
  }

  const [lists, orgs, orgCount, members] = await Promise.all([
    eventLists(scope, now),
    prisma.organization.findMany({
      where: { ...activeOrg, enterpriseId: ent.id },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, name: true, slug: true, logo: true, category: true },
    }),
    prisma.organization.count({ where: { ...activeOrg, enterpriseId: ent.id } }),
    prisma.enterpriseMember.count({ where: { enterpriseId: ent.id, isActive: true } }),
  ])

  const upcomingByOrg = orgs.length
    ? await prisma.event.groupBy({
        by: ["organizationId"],
        where: upcomingWhere({ organizationId: { in: orgs.map((o) => o.id) } }, now),
        _count: { _all: true },
      })
    : []
  const upcomingCount = new Map(upcomingByOrg.map((g) => [g.organizationId, g._count._all]))

  return {
    kind: "enterprise",
    name: ent.name,
    slug: ent.slug,
    description: ent.description?.trim() || null,
    logo: safeImageSrc(ent.logo),
    website: safeExternalUrl(ent.website),
    location: location([ent.city, ent.state, ent.country]),
    type: categoryLabel(ent.type),
    isVerified: ent.isVerified,
    socialLinks: publicSocialLinks(ent.socialLinks),
    organizations: orgs.map((o) => ({
      name: o.name,
      slug: o.slug,
      logo: safeImageSrc(o.logo),
      category: categoryLabel(o.category),
      upcomingEvents: upcomingCount.get(o.id) ?? 0,
    })),
    counts: { organizations: orgCount, upcomingEvents: lists.upcomingCount, pastEvents: lists.pastCount, members },
    upcomingEvents: lists.upcomingEvents,
    pastEvents: lists.pastEvents,
  }
}

/** A one-line description for search engines and link previews (max ~160 characters). */
export function profileMetaDescription(name: string, description: string | null, fallback: string): string {
  const text = (description ?? "").replace(/\s+/g, " ").trim()
  if (!text) return fallback
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text
}

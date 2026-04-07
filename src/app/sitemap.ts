import type { MetadataRoute } from "next"
import prisma from "@/lib/prisma"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://eventflow.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/events`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/for-organizers`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/developers`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ]

  const categories = ["tech", "cultural", "sports", "workshop", "hackathon", "conference", "seminar", "webinar", "competition"]
  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${baseUrl}/events?category=${cat.toUpperCase()}`,
    changeFrequency: "daily",
    priority: 0.8,
  }))

  let eventPages: MetadataRoute.Sitemap = []
  let orgPages: MetadataRoute.Sitemap = []

  try {
    const events = await prisma.event.findMany({
      where: { status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "ONGOING"] }, visibility: "PUBLIC", deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    })

    eventPages = events.map((event) => ({
      url: `${baseUrl}/events/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))

    const orgs = await prisma.organization.findMany({
      where: { isActive: true, deletedAt: null },
      select: { slug: true, updatedAt: true },
    })

    orgPages = orgs.map((org) => ({
      url: `${baseUrl}/org/${org.slug}`,
      lastModified: org.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }))
  } catch {
    // Database not available during build — return static pages only
  }

  return [...staticPages, ...categoryPages, ...eventPages, ...orgPages]
}

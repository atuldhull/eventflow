import type { Metadata } from "next"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorize } from "@/lib/authorization"
import { PERMISSIONS } from "@/lib/permissions"
import { liveWorkspaceWhere } from "@/lib/public-events"

// The event page shows these; anything else (drafts, pending approval, postponed) is a 404
const VISIBLE_STATUSES = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED"]

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params

  const event = await prisma.event.findFirst({
    // a deactivated or deleted organization/enterprise takes its events down with it
    where: { slug, ...liveWorkspaceWhere() },
    select: {
      title: true, shortDescription: true, coverImage: true, category: true, startDate: true, venue: true, venueCity: true,
      isOnline: true, status: true, visibility: true, deletedAt: true, seoTitle: true, seoDescription: true,
      organization: { select: { name: true } },
    },
  })

  // Don't reveal a draft's title or description through the page's metadata
  if (!event || event.deletedAt || !VISIBLE_STATUSES.includes(event.status)) {
    return { title: "Event not found", description: "This event does not exist.", robots: { index: false } }
  }

  // Private and invite-only events: the page shows a "private event" notice, so keep the
  // details out of link previews too
  if (event.visibility === "PRIVATE" || event.visibility === "INVITE_ONLY") {
    return { title: event.title, robots: { index: false, follow: false } }
  }

  const dateStr = event.startDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  const location = event.isOnline ? "Online" : (event.venue || event.venueCity || "TBA")
  const title = event.seoTitle?.trim() || event.title
  const description = event.seoDescription?.trim() || event.shortDescription || `${event.title} by ${event.organization?.name || "EventFlow"} on ${dateStr} at ${location}`

  return {
    title,
    description,
    // Unlisted events are shared by link only: keep them out of search results
    ...(event.visibility === "UNLISTED" ? { robots: { index: false } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      ...(event.coverImage ? { images: [{ url: event.coverImage, width: 1200, height: 630, alt: event.title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(event.coverImage ? { images: [event.coverImage] } : {}),
    },
  }
}

/**
 * The event page renders on the client, so an unknown slug would otherwise come back as a
 * 200 with a "not found" message. Answer with a real 404 here when the event doesn't exist,
 * was deleted, or is hidden (draft, pending approval, ...) from this viewer. Organizers who
 * can edit the event still get the page, for its ?preview=1 view, the same rule as
 * GET /api/events/[slug]?preview=1.
 */
export default async function EventSlugLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await prisma.event.findFirst({
    // a deactivated or deleted organization/enterprise takes its events down with it
    where: { slug, ...liveWorkspaceWhere() },
    select: { status: true, deletedAt: true, organizationId: true },
  })
  if (!event || event.deletedAt) notFound()

  if (!VISIBLE_STATUSES.includes(event.status)) {
    const session = await auth()
    const canPreview =
      !!session?.user?.id &&
      !!event.organizationId &&
      (await authorize(session.user.id, PERMISSIONS.EVENT_EDIT, { organizationId: event.organizationId })).authorized
    if (!canPreview) notFound()
  }

  return <>{children}</>
}

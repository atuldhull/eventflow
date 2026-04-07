import type { Metadata } from "next"
import prisma from "@/lib/prisma"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { title: true, shortDescription: true, coverImage: true, category: true, startDate: true, venue: true, venueCity: true, isOnline: true, organization: { select: { name: true } } },
  })

  if (!event) {
    return { title: "Event Not Found | EventFlow", description: "This event does not exist." }
  }

  const dateStr = event.startDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  const location = event.isOnline ? "Online" : (event.venue || event.venueCity || "TBA")
  const description = event.shortDescription || `${event.title} by ${event.organization?.name || "EventFlow"} on ${dateStr} at ${location}`

  return {
    title: `${event.title} | EventFlow`,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "website",
      ...(event.coverImage ? { images: [{ url: event.coverImage, width: 1200, height: 630, alt: event.title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      ...(event.coverImage ? { images: [event.coverImage] } : {}),
    },
  }
}

export default function EventSlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://eventflow.com"

export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "EventFlow",
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: "Professional Event Management Platform",
    sameAs: [],
  }
}

export function getEventSchema(event: {
  title: string
  description: string
  slug: string
  startDate: string
  endDate: string
  venue?: string | null
  venueCity?: string | null
  isOnline: boolean
  coverImage?: string | null
  isPaid: boolean
  organizerName?: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    url: `${baseUrl}/events/${event.slug}`,
    startDate: event.startDate,
    endDate: event.endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: event.isOnline
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    location: event.isOnline
      ? { "@type": "VirtualLocation", url: `${baseUrl}/events/${event.slug}` }
      : { "@type": "Place", name: event.venue || "TBA", address: event.venueCity || "" },
    image: event.coverImage || `${baseUrl}/og-image.png`,
    organizer: { "@type": "Organization", name: event.organizerName || "EventFlow" },
    isAccessibleForFree: !event.isPaid,
  }
}

export function getBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

import { cache } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Building2, CalendarCheck, CalendarClock, CalendarX2, Globe, History, MapPin, Users } from "lucide-react"
import { ProfileEvents, ProfileSection, PublicProfile, type ProfileDetail } from "@/components/marketing/PublicProfile"
import { getPublicOrganization, profileMetaDescription } from "@/lib/public-profiles"

// One query per request, shared by the metadata and the page
const loadOrganization = cache((slug: string) => getPublicOrganization(slug))

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const org = await loadOrganization(slug)
  // Throwing here (not just in the page) lets crawlers get a real 404 status
  if (!org) notFound()

  const description = profileMetaDescription(org.name, org.description, `Upcoming and past events by ${org.name} on EventFlow.`)
  return {
    title: org.name,
    description,
    alternates: { canonical: `/org/${org.slug}` },
    openGraph: {
      title: org.name,
      description,
      type: "profile",
      url: `/org/${org.slug}`,
      ...(org.logo ? { images: [{ url: org.logo, alt: org.name }] } : {}),
    },
    twitter: { card: "summary", title: org.name, description },
  }
}

export default async function OrgPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await loadOrganization(slug)
  if (!org) notFound()

  const details: ProfileDetail[] = [
    { icon: CalendarClock, label: "Upcoming events", value: org.counts.upcomingEvents },
    { icon: History, label: "Past events", value: org.counts.pastEvents },
    { icon: Users, label: "Members", value: org.counts.members },
  ]
  if (org.location) details.push({ icon: MapPin, label: "Location", value: <span>{org.location}</span> })
  if (org.website) {
    details.push({
      icon: Globe,
      label: "Website",
      value: (
        <a href={org.website.href} target="_blank" rel="noopener noreferrer nofollow" className="block truncate underline decoration-lavender decoration-2 underline-offset-4 transition-colors hover:text-brand">
          {org.website.label}
        </a>
      ),
    })
  }
  if (org.enterprise) {
    details.push({
      icon: Building2,
      label: "Part of",
      value: (
        <Link href={`/enterprise/${org.enterprise.slug}`} className="block truncate underline decoration-lavender decoration-2 underline-offset-4 transition-colors hover:text-brand">
          {org.enterprise.name}
        </Link>
      ),
    })
  }

  return (
    <PublicProfile
      name={org.name}
      logo={org.logo}
      isVerified={org.isVerified}
      meta={["Organization", org.category, org.location].filter(Boolean)}
      website={org.website}
      about={org.description}
      details={details}
      links={org.socialLinks}
    >
      <ProfileSection title="Upcoming events" count={org.counts.upcomingEvents}>
        <ProfileEvents events={org.upcomingEvents} total={org.counts.upcomingEvents} empty="No upcoming events right now." icon={CalendarX2} />
      </ProfileSection>
      {org.pastEvents.length > 0 && (
        <ProfileSection title="Past events" count={org.counts.pastEvents}>
          <ProfileEvents events={org.pastEvents} total={org.counts.pastEvents} empty="No past events." icon={CalendarCheck} />
        </ProfileSection>
      )}
    </PublicProfile>
  )
}

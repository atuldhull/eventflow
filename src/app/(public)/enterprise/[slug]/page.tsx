import { cache } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Building2, CalendarCheck, CalendarClock, CalendarX2, Globe, History, MapPin, Users } from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"
import { ProfileEvents, ProfileMark, ProfileSection, PublicProfile, type ProfileDetail } from "@/components/marketing/PublicProfile"
import { getPublicEnterprise, profileMetaDescription } from "@/lib/public-profiles"

// One query per request, shared by the metadata and the page
const loadEnterprise = cache((slug: string) => getPublicEnterprise(slug))

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const ent = await loadEnterprise(slug)
  // Throwing here (not just in the page) lets crawlers get a real 404 status
  if (!ent) notFound()

  const description = profileMetaDescription(ent.name, ent.description, `Organizations and events of ${ent.name} on EventFlow.`)
  return {
    title: ent.name,
    description,
    alternates: { canonical: `/enterprise/${ent.slug}` },
    openGraph: {
      title: ent.name,
      description,
      type: "profile",
      url: `/enterprise/${ent.slug}`,
      ...(ent.logo ? { images: [{ url: ent.logo, alt: ent.name }] } : {}),
    },
    twitter: { card: "summary", title: ent.name, description },
  }
}

export default async function EnterprisePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ent = await loadEnterprise(slug)
  if (!ent) notFound()

  const details: ProfileDetail[] = [
    { icon: Building2, label: "Organizations", value: ent.counts.organizations },
    { icon: CalendarClock, label: "Upcoming events", value: ent.counts.upcomingEvents },
    { icon: History, label: "Past events", value: ent.counts.pastEvents },
    { icon: Users, label: "Members", value: ent.counts.members },
  ]
  if (ent.location) details.push({ icon: MapPin, label: "Location", value: <span className="font-normal">{ent.location}</span> })
  if (ent.website) {
    details.push({
      icon: Globe,
      label: "Website",
      value: (
        <a href={ent.website.href} target="_blank" rel="noopener noreferrer nofollow" className="block max-w-[160px] truncate font-normal underline-offset-4 hover:text-brand hover:underline">
          {ent.website.label}
        </a>
      ),
    })
  }

  return (
    <PublicProfile
      name={ent.name}
      logo={ent.logo}
      isVerified={ent.isVerified}
      meta={["Enterprise", ent.type, ent.location].filter(Boolean)}
      website={ent.website}
      about={ent.description}
      details={details}
      links={ent.socialLinks}
    >
      <ProfileSection title="Organizations" count={ent.counts.organizations}>
        {ent.organizations.length === 0 ? (
          <EmptyState icon={Building2} title="No organizations yet." />
        ) : (
          <ul className="divide-y divide-rule rounded-lg border bg-card">
            {ent.organizations.map((org) => (
              <li key={org.slug} className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised">
                <ProfileMark name={org.name} logo={org.logo} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/org/${org.slug}`} className="block truncate text-sm font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline group-hover:underline group-hover:underline-offset-4">
                    {org.name}
                  </Link>
                  {org.category && <p className="truncate text-[13px] text-muted-foreground">{org.category}</p>}
                </div>
                <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                  {org.upcomingEvents > 0 ? `${org.upcomingEvents} upcoming` : "No upcoming events"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ProfileSection>

      <ProfileSection title="Upcoming events" count={ent.counts.upcomingEvents}>
        <ProfileEvents events={ent.upcomingEvents} total={ent.counts.upcomingEvents} empty="No upcoming events right now." icon={CalendarX2} />
      </ProfileSection>
      {ent.pastEvents.length > 0 && (
        <ProfileSection title="Past events" count={ent.counts.pastEvents}>
          <ProfileEvents events={ent.pastEvents} total={ent.counts.pastEvents} empty="No past events." icon={CalendarCheck} />
        </ProfileSection>
      )}
    </PublicProfile>
  )
}

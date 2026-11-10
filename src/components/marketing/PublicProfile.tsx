import Link from "next/link"
import { ArrowUpRight, BadgeCheck, type LucideIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/EmptyState"
import { EventCard, type EventCardEvent } from "@/components/events/EventCard"
import { cn } from "@/lib/utils"
import { Container } from "./layout"

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"

/** The organization's logo on a bordered square, or its initials when there's no logo. */
export function ProfileMark({ name, logo, size = "lg" }: { name: string; logo: string | null; size?: "lg" | "sm" }) {
  const box = size === "lg" ? "size-16 rounded-lg" : "size-9 rounded-md"
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className={cn(box, "shrink-0 border border-rule bg-card object-cover")} />
  }
  return (
    <span
      aria-hidden
      className={cn(
        box,
        "flex shrink-0 items-center justify-center border border-rule bg-raised font-semibold text-muted-foreground",
        size === "lg" ? "text-lg" : "text-[13px]",
      )}
    >
      {initials(name)}
    </span>
  )
}

export interface ProfileDetail {
  icon: LucideIcon
  label: string
  value: React.ReactNode
}

/**
 * The public page of an organization or enterprise: an identity row (mark, name, a
 * verified check when the platform has verified it, a meta line, the website), then the
 * sections on the left and the details card on the right.
 */
export function PublicProfile({
  name,
  logo,
  isVerified,
  meta,
  website,
  about,
  details,
  links = [],
  children,
}: {
  name: string
  logo: string | null
  isVerified: boolean
  /** short facts for the line under the name: kind, category, place */
  meta: React.ReactNode[]
  website: { href: string; label: string } | null
  about: string | null
  details: ProfileDetail[]
  links?: { href: string; label: string }[]
  children?: React.ReactNode
}) {
  return (
    <>
      <header className="border-b border-rule">
        <Container className="flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between sm:py-16">
          <div className="flex min-w-0 items-center gap-5">
            <ProfileMark name={name} logo={logo} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[32px]">{name}</h1>
                {isVerified && <BadgeCheck className="size-5 shrink-0 text-brand" aria-label="Verified" role="img" />}
              </div>
              {meta.length > 0 && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                  {meta.map((item, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i > 0 && <span aria-hidden>·</span>}
                      {item}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
          {website && (
            <a
              href={website.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={cn(buttonVariants({ variant: "outline" }), "shrink-0 gap-1.5 max-sm:w-full")}
            >
              Visit website <ArrowUpRight className="size-4" aria-hidden />
            </a>
          )}
        </Container>
      </header>

      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
        <div className="min-w-0 space-y-12">
          <ProfileSection title="About">
            {about ? (
              <p className="max-w-[65ch] text-[15px] leading-7 whitespace-pre-line text-muted-foreground">{about}</p>
            ) : (
              <p className="text-[15px] text-muted-foreground">{name} hasn&apos;t added a description yet.</p>
            )}
          </ProfileSection>
          {children}
        </div>

        <aside aria-labelledby="details-heading" className="h-fit rounded-lg border bg-card p-5 lg:sticky lg:top-[88px]">
          <h2 id="details-heading" className="text-[15px] font-semibold">Details</h2>
          <dl className="mt-3 divide-y divide-rule">
            {details.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-3 text-sm">
                <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                <dt className="flex-1 text-muted-foreground">{label}</dt>
                <dd className="min-w-0 text-right font-medium tabular-nums">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</dd>
              </div>
            ))}
          </dl>
          {links.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-3 text-[13px]">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-8 items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                    {l.label} <ArrowUpRight className="size-3" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </Container>
    </>
  )
}

const headingId = (title: string) => `${title.replace(/\s+/g, "-").toLowerCase()}-heading`

/** One section on a profile: a heading with an optional count, then its content. */
export function ProfileSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={headingId(title)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={headingId(title)} className="text-lg font-semibold">{title}</h2>
        {count !== undefined && count > 0 && <span className="text-[13px] text-muted-foreground tabular-nums">{count.toLocaleString("en-IN")}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Events as cards, or an empty state that says so. */
export function ProfileEvents({
  events,
  total,
  empty,
  icon,
}: {
  events: EventCardEvent[]
  total: number
  empty: string
  icon: LucideIcon
}) {
  if (events.length === 0) return <EmptyState icon={icon} title={empty} />
  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2">
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>
      {total > events.length && (
        <p className="mt-4 text-[13px] text-muted-foreground tabular-nums">
          Showing {events.length} of {total.toLocaleString("en-IN")}.{" "}
          <Link href="/events" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">Browse all events</Link>
        </p>
      )}
    </>
  )
}

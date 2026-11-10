import Link from "next/link"
import { ArrowUpRight, BadgeCheck, type LucideIcon } from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"
import { EventCard, type EventCardEvent } from "@/components/events/EventCard"
import { cn } from "@/lib/utils"
import { Container } from "./layout"
import { ctaLemon } from "./styles"

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"

/** A stable brand colour per name, so initials tiles vary but never change. */
function tileTone(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return ["bg-lemon text-lemon-ink", "bg-lavender text-charcoal", "bg-charcoal text-lemon"][h % 3]
}

/** The organization's logo, or its initials on a brand-coloured tile when there's no logo. */
export function ProfileMark({ name, logo, size = "lg" }: { name: string; logo: string | null; size?: "lg" | "sm" }) {
  const box = size === "lg" ? "size-20 rounded-2xl sm:size-24" : "size-11 rounded-xl"
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className={cn(box, "shrink-0 border border-white/10 bg-white object-cover")} />
  }
  return (
    <span
      aria-hidden
      className={cn(
        box,
        "font-display flex shrink-0 items-center justify-center font-extrabold tracking-[-0.04em]",
        size === "lg" ? "bg-lemon text-[32px] text-lemon-ink sm:text-[38px]" : cn("text-[15px]", tileTone(name)),
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
 * The public page of an organization or enterprise. A poster-like header on an
 * always-dark field: the mark, the name set huge, a verified check when the
 * platform has verified it, the meta line, the website, and the counts as big numbers.
 * Then the sections on the left and the remaining details beside them.
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
  // the counts go on the poster; the rest (place, website, parent) go beside the sections
  const stats = details.filter((d) => typeof d.value === "number")
  const facts = details.filter((d) => typeof d.value !== "number")
  const hasAside = facts.length > 0 || links.length > 0
  const long = name.length > 28

  return (
    <>
      <header className="relative overflow-hidden bg-charcoal text-white dark:bg-frame">
        <div aria-hidden className="pointer-events-none absolute -top-48 -right-40 size-[560px] rounded-full bg-lavender/30 blur-[140px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-40 size-[420px] rounded-full bg-lemon/10 blur-[140px]" />
        <Container className="relative pt-12 pb-10 sm:pt-16 sm:pb-14">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <ProfileMark name={name} logo={logo} />
              {meta.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-white/70">
                  {meta.map((item, i) => (
                    <span key={i} className={cn("flex items-center gap-2", i === 0 && "font-semibold text-lemon")}>
                      {i > 0 && <span aria-hidden className="text-white/35">·</span>}
                      {item}
                    </span>
                  ))}
                </p>
              )}
            </div>
            {website && (
              <a href={website.href} target="_blank" rel="noopener noreferrer nofollow" className={cn(ctaLemon, "h-11 shrink-0 px-5 max-sm:w-full")}>
                Visit website <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </a>
            )}
          </div>

          <h1
            className={cn(
              "font-display mt-10 max-w-[18ch] leading-[0.95] font-extrabold tracking-[-0.05em] break-words text-balance sm:mt-12",
              long ? "text-[40px] sm:text-[64px] lg:text-[80px]" : "text-[48px] sm:text-[80px] lg:text-[104px]",
            )}
          >
            {name}
            {isVerified && (
              <BadgeCheck
                className="ml-3 inline-block size-8 -translate-y-[0.15em] align-middle text-lavender sm:size-12"
                aria-label="Verified"
                role="img"
              />
            )}
          </h1>

          {stats.length > 0 && (
            <dl className="mt-10 grid grid-cols-2 border-t border-white/15 sm:mt-14 sm:grid-cols-4">
              {stats.map(({ label, value }, i) => (
                <div key={label} className={cn("flex flex-col-reverse gap-1 py-5 pr-4", i > 0 && "sm:border-l sm:border-white/15 sm:pl-6", i % 2 === 1 && "max-sm:border-l max-sm:border-white/15 max-sm:pl-4")}>
                  <dt className="text-[13px] text-white/60">{label}</dt>
                  <dd className={cn("font-display text-[40px] leading-none font-extrabold tracking-[-0.04em] tabular-nums sm:text-[56px]", i === 0 && "text-lemon")}>
                    {(value as number).toLocaleString("en-IN")}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Container>
        {/* a perforated edge, like the tear line of a ticket */}
        <div aria-hidden className="relative h-4">
          <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-white/15" />
          <span className="absolute top-0 -left-2 size-4 rounded-full bg-background" />
          <span className="absolute top-0 -right-2 size-4 rounded-full bg-background" />
        </div>
      </header>

      <Container className={cn("grid gap-12 py-14 sm:py-20", hasAside && "lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16")}>
        <div className="min-w-0 space-y-16">
          <ProfileSection title="About">
            {about ? (
              <p className="max-w-[62ch] text-[17px] leading-[1.75] whitespace-pre-line text-foreground/80">{about}</p>
            ) : (
              <p className="text-[16px] text-muted-foreground">{name} hasn&apos;t added a description yet.</p>
            )}
          </ProfileSection>
          {children}
        </div>

        {hasAside && (
          <aside aria-labelledby="details-heading" className="h-fit lg:sticky lg:top-[88px]">
            <h2 id="details-heading" className="font-display text-[13px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              Details
            </h2>
            {facts.length > 0 && (
              <dl className="mt-4 border-t-2 border-foreground">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="border-b border-rule py-4">
                    <dt className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                      {label}
                    </dt>
                    <dd className="mt-1 min-w-0 text-[16px] font-semibold [&_a]:max-w-full">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {links.length > 0 && (
              <ul className={cn("flex flex-wrap gap-2", facts.length > 0 ? "mt-5" : "mt-4")}>
                {links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex min-h-10 items-center gap-1 rounded-full border px-4 text-[13px] font-medium transition-colors hover:border-lavender hover:bg-lavender/10"
                    >
                      {l.label} <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </Container>
    </>
  )
}

const headingId = (title: string) => `${title.replace(/\s+/g, "-").toLowerCase()}-heading`

/** One section on a profile: a big heading with an optional count, then its content. */
export function ProfileSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={headingId(title)}>
      <div className="flex items-center gap-3">
        <h2 id={headingId(title)} className="font-display text-[30px] leading-none font-extrabold tracking-[-0.04em] sm:text-[40px]">
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <span className="inline-flex h-7 items-center rounded-full bg-lemon px-3 text-[13px] font-semibold text-lemon-ink tabular-nums">
            {count.toLocaleString("en-IN")}
          </span>
        )}
      </div>
      <div className="mt-6">{children}</div>
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
  if (events.length === 0) return <EmptyState icon={icon} title={empty} className="rounded-3xl py-14" />
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
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-muted-foreground tabular-nums">
          Showing {events.length} of {total.toLocaleString("en-IN")}.
          <Link href="/events" className="inline-flex min-h-10 items-center rounded-full border px-4 font-medium text-foreground transition-colors hover:border-lavender hover:bg-lavender/10">
            Browse all events
          </Link>
        </p>
      )}
    </>
  )
}

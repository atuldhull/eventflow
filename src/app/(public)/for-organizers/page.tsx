import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Award, BarChart3, CheckCircle2, CreditCard, FormInput, LayoutTemplate, ScanLine, type LucideIcon } from "lucide-react"
import { Container } from "@/components/marketing/layout"
import { Marquee, Reveal, WordReveal } from "@/components/marketing/fx"
import { Highlighter, Kicker } from "@/components/marketing/kit"
import { SampleTicket } from "@/components/marketing/SampleTicket"
import { ctaGhost, ctaGhostDark, ctaLemon, heroTitle } from "@/components/marketing/styles"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "For Organizers",
  description: "Create, manage, and grow professional events with EventFlow. Built for universities, companies, and organizations.",
}

type Feature = { icon: LucideIcon; title: string; desc: string }

const FEATURES = {
  pages: { icon: LayoutTemplate, title: "Event pages", desc: "Create event pages with a step-by-step builder. Customize branding, add schedules, sponsors, and FAQs." },
  registration: { icon: FormInput, title: "Smart registration", desc: "Custom registration forms, team registration, approval workflows, waitlists, and CSV import/export." },
  payments: { icon: CreditCard, title: "Payments", desc: "Accept payments via Razorpay (UPI, cards, netbanking). Multiple ticket types, coupon codes, and refunds that sync back from Razorpay automatically." },
  checkin: { icon: ScanLine, title: "QR check-in", desc: "Scan and go. Real-time attendance tracking with multiple scanners and offline support." },
  analytics: { icon: BarChart3, title: "Analytics", desc: "Track registrations, revenue, attendance rates, and more with detailed dashboards." },
  certificates: { icon: Award, title: "Certificates", desc: "Auto-generate and distribute professional certificates with customizable templates." },
} satisfies Record<string, Feature>

const AUDIENCES = [
  { title: "Universities", desc: "Manage fests, workshops, and club events" },
  { title: "Companies", desc: "Corporate events, conferences, team activities" },
  { title: "Communities", desc: "Meetups, hackathons, open events" },
  { title: "NGOs", desc: "Fundraisers, awareness events, volunteer drives" },
]

/** the life of an event, in the order an organizer meets it */
const CHAPTERS = [
  { n: "01", stage: "Publish", line: "Put it out there" },
  { n: "02", stage: "Register", line: "Let people in" },
  { n: "03", stage: "Sell", line: "Get paid" },
  { n: "04", stage: "Door", line: "Run the door" },
  { n: "05", stage: "After", line: "Close it out" },
]

function FeatureText({ feature, onDark = false, onLavender = false, className }: { feature: Feature; onDark?: boolean; onLavender?: boolean; className?: string }) {
  const Icon = feature.icon
  return (
    <div className={className}>
      <h3 className="font-display flex items-center gap-2.5 text-[22px] font-bold tracking-[-0.02em]">
        <Icon className={cn("size-5", onDark ? "text-lemon" : onLavender ? "text-charcoal" : "text-brand")} strokeWidth={2} aria-hidden />
        {feature.title}
      </h3>
      <p className={cn("mt-2 max-w-[46ch] text-[16px] leading-relaxed", onDark ? "text-white/65" : onLavender ? "text-charcoal/75" : "text-muted-foreground")}>{feature.desc}</p>
    </div>
  )
}

function ChapterHead({ n, stage, line, onDark = false, onLemon = false }: { n: string; stage: string; line: string; onDark?: boolean; onLemon?: boolean }) {
  return (
    <div>
      <p className={cn("flex items-center gap-3 text-sm font-semibold", onLemon ? "text-lemon-ink" : onDark ? "text-lemon" : "text-brand")}>
        <span className="font-display text-[15px] tabular-nums">{n}</span>
        <span className={cn("h-[2px] w-8 rounded-full", onLemon ? "bg-charcoal" : onDark ? "bg-lavender" : "bg-lemon")} aria-hidden />
        {stage}
      </p>
      <h2 className="font-display mt-3 text-[40px] leading-[0.98] font-extrabold tracking-[-0.045em] sm:text-[64px]">{line}</h2>
    </div>
  )
}

export default function ForOrganizersPage() {
  return (
    <>
      {/* ========== INTRO ========== */}
      <header className="relative -mt-16 overflow-hidden pt-16">
        <div aria-hidden className="fx-aurora pointer-events-none absolute inset-0 -z-10">
          <span className="top-[-20%] right-[-10%] size-[520px] bg-lavender/35" />
          <span className="bottom-[-30%] left-[-10%] size-[420px] bg-lemon/25 dark:bg-lemon/10" />
        </div>
        <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />
        <Container className="pt-14 pb-14 sm:pt-20 sm:pb-20">
          <Kicker>For organizers</Kicker>
          <h1 className={cn(heroTitle, "mt-4 max-w-[15ch]")}>
            <WordReveal text="Your events," /> <Highlighter delay={0.45}>simplified</Highlighter>
          </h1>
          <Reveal delay={0.35} y={16}>
            <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-muted-foreground">
              Everything you need to create, manage, and grow professional events, from the first registration to the certificate.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={ctaLemon}>
                Start organizing for free
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </Link>
              <Link href="/pricing" className={ctaGhost}>
                See pricing
              </Link>
            </div>
          </Reveal>

          {/* the five chapters below, as a jump list */}
          <Reveal delay={0.5} y={16}>
            <nav aria-label="The life of an event" className="mt-14">
              <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-5">
                {CHAPTERS.map((c, i) => (
                  <li key={c.n} className={cn(i === 4 && "col-span-2 sm:col-span-1")}>
                    <a href={`#stage-${c.stage.toLowerCase()}`} className="group flex h-full min-h-[76px] flex-col justify-between gap-2 bg-background p-4 transition-colors hover:bg-lemon hover:text-lemon-ink">
                      <span className="font-display text-[13px] text-muted-foreground tabular-nums group-hover:text-lemon-ink/70">{c.n}</span>
                      <span className="font-display text-[20px] font-bold tracking-[-0.02em]">{c.stage}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </Reveal>
        </Container>
      </header>

      {/* ========== 01 PUBLISH ========== */}
      <section id="stage-publish" aria-label="Publish" className="scroll-mt-16 border-t border-rule">
        <Container className="grid gap-12 py-20 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-16">
          <Reveal>
            <ChapterHead {...CHAPTERS[0]} />
            <FeatureText feature={FEATURES.pages} className="mt-8" />
          </Reveal>
          {/* a sketch of an event page being built: the builder's steps down the side */}
          <Reveal delay={0.15} aria-hidden>
            <div className="overflow-hidden rounded-3xl border bg-card shadow-[0_30px_80px_-40px_rgb(0_0_0/0.5)]">
              <div className="flex items-center gap-1.5 border-b px-4 py-3">
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
              </div>
              <div className="grid grid-cols-[110px_minmax(0,1fr)] sm:grid-cols-[140px_minmax(0,1fr)]">
                <ol className="space-y-1 border-r p-3 text-[13px]">
                  {["Basics", "Schedule", "Tickets", "Sponsors", "FAQs", "Publish"].map((s, i) => (
                    <li key={s} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", i === 5 ? "bg-lemon font-semibold text-lemon-ink" : i < 5 ? "text-foreground" : "text-muted-foreground")}>
                      {i < 5 ? <CheckCircle2 className="size-3.5 text-brand" /> : <span className="size-3.5 rounded-full border-2 border-charcoal" />}
                      {s}
                    </li>
                  ))}
                </ol>
                <div className="p-4 sm:p-5">
                  <div className="flex aspect-[16/7] items-end rounded-2xl bg-lavender p-4 text-charcoal">
                    <span className="font-display text-[22px] leading-none font-extrabold tracking-[-0.03em] sm:text-[28px]">Your event</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-2.5 w-4/5 rounded-full bg-raised" />
                    <div className="h-2.5 w-3/5 rounded-full bg-raised" />
                    <div className="h-2.5 w-2/3 rounded-full bg-raised" />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ========== 02 REGISTER ========== */}
      <section id="stage-register" aria-label="Register" className="scroll-mt-16 bg-lavender text-charcoal">
        <Container className="grid gap-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          <Reveal className="lg:order-2">
            <ChapterHead {...CHAPTERS[1]} onLemon />
            <FeatureText feature={FEATURES.registration} onLavender className="mt-8" />
          </Reveal>
          {/* the registration tools set as big words, not cards */}
          <Reveal delay={0.15} className="lg:order-1">
            <ul aria-label="Registration tools" className="font-display flex flex-wrap gap-3 text-[20px] font-bold tracking-[-0.02em] sm:text-[26px]">
              {["Custom forms", "Team registration", "Approvals", "Waitlists", "CSV import", "CSV export"].map((w, i) => (
                <li
                  key={w}
                  className={cn(
                    "rounded-full px-5 py-2.5",
                    i % 3 === 0 ? "bg-lemon text-lemon-ink" : i % 3 === 1 ? "border-2 border-charcoal/80" : "bg-charcoal text-lemon",
                    i % 2 ? "rotate-1" : "-rotate-1",
                  )}
                >
                  {w}
                </li>
              ))}
            </ul>
          </Reveal>
        </Container>
      </section>

      {/* ========== 03 SELL ========== */}
      <section id="stage-sell" aria-label="Sell" className="scroll-mt-16 bg-lemon text-lemon-ink">
        <Container className="grid gap-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-16">
          <Reveal>
            <ChapterHead {...CHAPTERS[2]} onLemon />
            <p className="font-display mt-8 max-w-[18ch] text-[28px] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[36px]">
              Razorpay at the checkout: UPI, cards, netbanking.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <h3 className="font-display flex items-center gap-2.5 text-[22px] font-bold tracking-[-0.02em]">
              <CreditCard className="size-5" strokeWidth={2} aria-hidden />
              {FEATURES.payments.title}
            </h3>
            <p className="mt-2 max-w-[46ch] text-[16px] leading-relaxed text-lemon-ink/80">{FEATURES.payments.desc}</p>
          </Reveal>
        </Container>
      </section>

      {/* ========== 04 DOOR ========== */}
      <section id="stage-door" aria-label="Door" className="scroll-mt-16 relative overflow-hidden">
        <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />
        <Container className="grid gap-14 py-20 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-16">
          <Reveal>
            <ChapterHead {...CHAPTERS[3]} />
            <FeatureText feature={FEATURES.checkin} className="mt-8" />
          </Reveal>
          <Reveal delay={0.15} aria-hidden className="relative mx-auto w-full max-w-[460px]">
            <div className="-rotate-2 drop-shadow-[0_24px_40px_rgb(0_0_0/0.3)]">
              <SampleTicket
                notchClassName="bg-background"
                ticket={{ month: "Nov", day: 13, weekday: "Fri", title: "Your event", venue: "Main gate", status: "checked_in", ticketType: "General", code: "TKT-8F3K2" }}
              />
            </div>
            <div className="absolute -right-2 -bottom-8 rotate-3 rounded-full bg-lavender px-4 py-2 text-[13px] font-semibold text-charcoal shadow-xl sm:-right-6">
              <span className="flex items-center gap-2">
                <ScanLine className="size-4" /> Works offline
              </span>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ========== 05 AFTER ========== */}
      <section id="stage-after" aria-label="After" className="scroll-mt-16 border-t border-rule">
        <Container className="py-20 sm:py-28">
          <Reveal>
            <ChapterHead {...CHAPTERS[4]} />
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Reveal className="h-full">
              <div className="flex h-full flex-col justify-between gap-10 rounded-3xl bg-charcoal p-7 text-white sm:p-9 dark:border dark:border-white/10">
                {/* a bar sketch: illustration only, no real figures */}
                <div aria-hidden className="flex h-32 items-end gap-2">
                  {[38, 52, 46, 70, 64, 88, 76, 100].map((h, i) => (
                    <span key={i} className={cn("flex-1 rounded-t-md", i === 7 ? "bg-lemon" : "bg-lavender/70")} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <FeatureText feature={FEATURES.analytics} onDark />
              </div>
            </Reveal>
            <Reveal delay={0.12} className="h-full">
              <div className="flex h-full flex-col justify-between gap-10 rounded-3xl bg-lavender p-7 text-charcoal sm:p-9">
                <div aria-hidden className="rounded-2xl border-2 border-charcoal/80 bg-white/40 p-5 text-center">
                  <p className="text-[11px] font-semibold tracking-[0.2em] uppercase">Certificate of participation</p>
                  <p className="font-display mt-3 text-[26px] leading-none font-extrabold tracking-[-0.03em]">Your attendee</p>
                  <div className="mx-auto mt-4 h-px w-24 bg-charcoal/60" />
                </div>
                <div>
                  <h3 className="font-display flex items-center gap-2.5 text-[22px] font-bold tracking-[-0.02em]">
                    <Award className="size-5" strokeWidth={2} aria-hidden />
                    {FEATURES.certificates.title}
                  </h3>
                  <p className="mt-2 max-w-[46ch] text-[16px] leading-relaxed text-charcoal/75">{FEATURES.certificates.desc}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ========== BUILT FOR ========== */}
      <section aria-labelledby="audiences-heading" className="overflow-hidden border-t border-rule">
        <div aria-hidden className="rotate-1 bg-lavender py-3 text-charcoal">
          <Marquee speed={44}>
            {["Fests", "Workshops", "Club events", "Conferences", "Meetups", "Hackathons", "Fundraisers", "Volunteer drives"].map((w) => (
              <span key={w} className="flex items-center gap-6 px-3 text-[15px] font-semibold">
                {w}
                <span className="size-1.5 rounded-full bg-charcoal" />
              </span>
            ))}
          </Marquee>
        </div>
        <Container className="py-20 sm:py-28">
          <Reveal>
            <Kicker>Built for everyone</Kicker>
            <h2 id="audiences-heading" className="sr-only">Built for everyone</h2>
          </Reveal>
          <Reveal>
          <ul className="mt-8 border-t-2 border-foreground">
            {AUDIENCES.map((a) => (
                <li key={a.title} className="group grid gap-1 border-b border-rule py-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-baseline sm:gap-8">
                  <h3 className="font-display text-[40px] leading-none font-extrabold tracking-[-0.045em] transition-colors duration-300 group-hover:text-brand sm:text-[64px]">
                    {a.title}
                  </h3>
                  <p className="text-[17px] text-muted-foreground">{a.desc}</p>
                </li>
            ))}
          </ul>
          </Reveal>
        </Container>
      </section>

      {/* ========== CLOSE ========== */}
      <section aria-labelledby="cta-heading" className="relative overflow-hidden bg-charcoal text-white dark:border-t dark:border-white/10">
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-lavender/25 blur-[140px]" />
        <Container className="relative py-20 sm:py-28">
          <Reveal className="relative grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <h2 id="cta-heading" className="font-display max-w-[14ch] text-[40px] leading-[0.98] font-extrabold tracking-[-0.045em] sm:text-[64px]">
                Ready to get <span className="fx-gradient-text">started?</span>
              </h2>
              <p className="mt-4 max-w-[44ch] text-[17px] text-white/65">Create your free account and start organizing events today.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={ctaLemon}>
                Create free account
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </Link>
              <Link href="/contact" className={ctaGhostDark}>
                Talk to us
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MotionConfig, motion } from "framer-motion"
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  Braces,
  Calendar,
  Check,
  CheckCircle2,
  Code,
  CreditCard,
  FormInput,
  GraduationCap,
  LayoutTemplate,
  Monitor,
  Palette,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trophy,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { FeaturedEvents } from "@/components/events/FeaturedEvents"
import { SampleTicket, type SampleTicketData } from "@/components/marketing/SampleTicket"
import { Container } from "@/components/marketing/layout"
import { CountUp, Marquee, Reveal, Spotlight, Tilt, WordReveal } from "@/components/marketing/fx"
import { cn } from "@/lib/utils"

// Each links to /events filtered by that category; the last tile opens the full list.
const CATEGORIES: { icon: LucideIcon; label: string; href?: string }[] = [
  { icon: Code, label: "Tech" },
  { icon: Palette, label: "Cultural" },
  { icon: Trophy, label: "Sports" },
  { icon: GraduationCap, label: "Workshop" },
  { icon: Braces, label: "Hackathon" },
  { icon: Users, label: "Conference" },
  { icon: BookOpen, label: "Seminar" },
  { icon: Monitor, label: "Webinar" },
  { icon: Award, label: "Competition" },
  { icon: Calendar, label: "All events", href: "/events" },
]

const STEPS = [
  { title: "Find an event", desc: "Browse by college, category or date. Save the ones you like." },
  { title: "Register", desc: "Pick a ticket, apply a coupon if you have one, and confirm in seconds." },
  { title: "Show your ticket", desc: "Open it on your phone at the door. It works offline once opened." },
]

const FEATURES = [
  { icon: LayoutTemplate, title: "Event builder", desc: "A 6-step wizard for single, multi-day, virtual, hybrid and recurring events." },
  { icon: FormInput, title: "Smart registration", desc: "12 custom field types, team registration, guest checkout, email domain rules and approvals." },
  { icon: CreditCard, title: "Payments and tickets", desc: "Razorpay, coupons, dynamic pricing, ticket transfer, add-ons and GST-compliant invoices." },
  { icon: ScanLine, title: "QR check-in", desc: "Scan from any phone with offline support, undo, manual search and multiple devices." },
  { icon: BarChart3, title: "Analytics", desc: "Registration funnels, revenue, attendance, geography and exportable reports." },
  { icon: ShieldCheck, title: "Enterprise grade", desc: "Multi-tenant hierarchy, 9-role access control, audit logs, custom domains, white-label and SSO." },
]

const PLANS = [
  { name: "Free", price: "₹0", period: "/month", features: ["5 events/month", "100 participants", "Basic analytics", "Email support"], cta: "Get started", href: "/signup" },
  { name: "Pro", price: "₹999", period: "/month", features: ["Unlimited events", "5,000 participants", "Advanced analytics", "Custom branding", "Priority support"], cta: "Start free trial", href: "/signup?plan=pro", popular: true },
  { name: "Enterprise", price: "Custom", period: "", features: ["Unlimited everything", "White-label", "SSO integration", "Dedicated support", "API access"], cta: "Contact sales", href: "/contact" },
]

const HERO_TICKETS: SampleTicketData[] = [
  { month: "Nov", day: 13, weekday: "Fri", title: "Winter Hackathon 2026", venue: "Main auditorium", status: "confirmed", ticketType: "General", code: "TKT-8F3K2" },
  { month: "Nov", day: 6, weekday: "Fri", title: "Design Sprint: Campus App", venue: "Studio B", status: "checked_in", ticketType: "Student", code: "TKT-2M9QA" },
  { month: "Nov", day: 20, weekday: "Fri", title: "Classical Night", venue: "Open-air theatre", status: "confirmed", ticketType: "VIP", code: "TKT-7XC4D" },
]

const EASE = [0.22, 1, 0.36, 1] as const

/** Lemon fill for CTAs; stays charcoal-on-lemon in both themes. */
const ctaLemon =
  "group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lemon px-6 text-[15px] font-semibold text-lemon-ink transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_var(--lemon)] active:translate-y-0 active:scale-[0.98]"
const ctaGhost =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-foreground/15 px-6 text-[15px] font-medium transition-colors duration-300 hover:border-lavender hover:bg-lavender/10"

export default function LandingPage() {
  const [stats, setStats] = useState({ events: 0, registrations: 0, organizations: 0 })
  const [statsLoaded, setStatsLoaded] = useState(false)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats")
        const json = await res.json()
        if (json.success) setStats(json.data)
      } catch {} finally {
        setStatsLoaded(true)
      }
    }
    fetchStats()
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      {/* ========== HERO ========== */}
      <section className="relative -mt-16 overflow-hidden pt-16">
        {/* moving aurora: lavender, lemon and violet light drifting behind a fading grid */}
        <div aria-hidden className="fx-aurora pointer-events-none absolute inset-0 -z-10">
          <span className="top-[-10%] left-[-5%] size-[520px] bg-lavender/45 dark:bg-lavender/35" />
          <span className="top-[20%] right-[-8%] size-[440px] bg-lemon/35 dark:bg-lemon/15" />
          <span className="bottom-[-20%] left-[30%] size-[480px] bg-[#6d28d9]/25" />
        </div>
        <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />

        <Container className="grid items-center gap-14 pt-10 pb-20 sm:pt-14 lg:min-h-[calc(100svh-64px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12 lg:pt-6 lg:pb-16">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full border border-lavender/40 bg-lavender/10 py-1.5 pr-3.5 pl-2 text-[13px] font-medium"
            >
              <span className="relative flex size-2.5">
                <span className="fx-ping absolute inline-flex size-full rounded-full bg-lavender" />
                <span className="relative inline-flex size-2.5 rounded-full bg-lavender" />
              </span>
              New: offline tickets and one-tap refunds
            </motion.div>

            <h1 className="font-display mt-6 text-[42px] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-[60px] lg:text-[64px] xl:text-[76px]">
              <WordReveal text="Events people actually" delay={0.1} />{" "}
              <span className="relative z-0 inline-block px-[0.06em] whitespace-nowrap">
                <motion.span
                  aria-hidden
                  className="absolute -inset-x-[0.04em] top-[0.02em] bottom-[0.04em] -z-10 origin-left -rotate-[1.5deg] rounded-[0.16em] bg-lemon"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, delay: 0.75, ease: EASE }}
                />
                <WordReveal text="show up" delay={0.4} className="relative text-lemon-ink" />
              </span>{" "}
              <WordReveal text="for." delay={0.55} className="fx-gradient-text fx-on-light" />
            </h1>

            <Reveal delay={0.7} y={16}>
              <p className="mt-7 max-w-[50ch] text-[17px] leading-relaxed text-muted-foreground">
                Find what&apos;s on at your college, register in a minute and carry your ticket on your phone. Organizers get registrations,
                payments, QR check-in and certificates in one place.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/events" className={ctaLemon}>
                  Browse events
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </Link>
                <Link href="/signup" className={ctaGhost}>
                  Host an event
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.85} y={16}>
              <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-6" aria-busy={!statsLoaded}>
                {[
                  { label: "events created", value: stats.events },
                  { label: "registrations", value: stats.registrations },
                  { label: "organizations", value: stats.organizations },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col-reverse">
                    <dt className="mt-1 text-[13px] text-muted-foreground">{s.label}</dt>
                    <dd className="font-display text-[34px] leading-none font-bold tracking-[-0.03em]">
                      {statsLoaded ? <CountUp value={s.value} /> : <Skeleton className="h-9 w-20" />}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          {/* tickets floating in 3D, tilting toward the pointer */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, y: 60, rotate: -4 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
            className="relative mx-auto w-full max-w-[540px]"
          >
            <div className="absolute inset-[8%] -z-10 rounded-full bg-lavender/40 blur-[90px]" />
            {/* a gentle tilt and no depth offsets, so the ticket text stays sharp */}
            <Tilt max={5}>
              <div className="flex flex-col gap-4">
                {HERO_TICKETS.map((t, i) => (
                  <motion.div
                    key={t.code}
                    initial={{ opacity: 0, x: i % 2 ? 80 : -80, rotate: i % 2 ? 5 : -5 }}
                    animate={{ opacity: 1, x: 0, rotate: [-1.5, 1, -0.5][i] }}
                    transition={{ duration: 1, delay: 0.5 + i * 0.15, ease: EASE }}
                    className={cn("drop-shadow-[0_24px_40px_rgb(0_0_0/0.35)]", i === 1 && "sm:ml-10", i === 2 && "max-sm:hidden sm:ml-4")}
                  >
                    <div className="fx-float" style={{ animationDelay: `${i * -2}s` }}>
                      <SampleTicket ticket={t} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </Tilt>

            {/* floating status chips */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.3, type: "spring", bounce: 0.5 }}
              className="absolute -top-12 left-1/3 sm:-top-14"
            >
              <div className="fx-float flex items-center gap-2 rounded-full bg-lemon px-4 py-2 text-[13px] font-semibold text-lemon-ink shadow-xl" style={{ animationDelay: "-1s" }}>
                <CheckCircle2 className="size-4" /> Checked in · 412
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.5, type: "spring", bounce: 0.5 }}
              className="absolute -bottom-6 -left-2 sm:-left-8"
            >
              <div className="fx-float flex items-center gap-2 rounded-full bg-lavender px-4 py-2 text-[13px] font-semibold text-charcoal shadow-xl" style={{ animationDelay: "-3s" }}>
                <Undo2 className="size-4" /> ₹499 refunded instantly
              </div>
            </motion.div>
          </motion.div>
        </Container>
      </section>

      {/* ========== MARQUEE BAND ========== */}
      <section aria-hidden className="relative z-10 -mt-8 overflow-hidden py-12">
        <div className="-rotate-2 bg-lemon py-4 text-lemon-ink shadow-[0_20px_60px_-20px_var(--lemon)]">
          <Marquee speed={36}>
            {["Hackathons", "Fests", "Workshops", "Concerts", "Seminars", "Sports meets", "Conferences", "Webinars", "Competitions", "Club nights"].map((w) => (
              <span key={w} className="font-display flex items-center gap-8 px-4 text-[26px] font-extrabold tracking-[-0.03em] sm:text-[34px]">
                {w}
                <Sparkles className="size-6 shrink-0" />
              </span>
            ))}
          </Marquee>
        </div>
        <div className="mt-[-12px] rotate-1 bg-lavender py-3 text-charcoal">
          <Marquee speed={44} className="[&_.fx-marquee]:[animation-direction:reverse]">
            {["QR check-in", "Razorpay payments", "Certificates", "Offline tickets", "Analytics", "Team registration", "Coupons", "Refunds"].map((w) => (
              <span key={w} className="flex items-center gap-6 px-3 text-[15px] font-semibold">
                {w}
                <span className="size-1.5 rounded-full bg-charcoal" />
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ========== CATEGORIES ========== */}
      <section aria-labelledby="categories-heading">
        <Container className="py-24 sm:py-28">
          <Reveal>
            <SectionTitle id="categories-heading" kicker="Explore" title="Find events by category" description="What's on across tech, culture, sport and more." />
          </Reveal>
          <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
            {CATEGORIES.map(({ icon: Icon, label, href }, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ duration: 0.6, delay: (i % 5) * 0.06 + Math.floor(i / 5) * 0.12, ease: EASE }}
              >
                <Spotlight className="h-full rounded-2xl">
                  <Link
                    href={href ?? `/events?category=${encodeURIComponent(label.toUpperCase())}`}
                    className={cn(
                      "group relative flex h-full min-h-[120px] flex-col justify-between gap-6 overflow-hidden rounded-2xl border p-5 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-lavender/60",
                      href && "border-lemon/50 bg-lemon/[0.06]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:scale-110 group-hover:-rotate-12",
                        href ? "bg-lemon text-lemon-ink" : "bg-lavender/15 text-brand",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="text-[15px] font-semibold">{label}</span>
                    <ArrowUpRight
                      className="absolute top-5 right-5 size-4 -translate-x-1 translate-y-1 text-brand opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
                      aria-hidden
                    />
                  </Link>
                </Spotlight>
              </motion.li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Featured events (fetches its own list) */}
      <Reveal>
        <FeaturedEvents />
      </Reveal>

      {/* ========== HOW IT WORKS ========== */}
      <section aria-labelledby="how-heading">
        <Container className="py-24 sm:py-28">
          <Reveal>
            <SectionTitle id="how-heading" kicker="Three steps" title="How it works" />
          </Reveal>
          <ol className="relative mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
            {/* the line that draws itself across the three steps */}
            <motion.span
              aria-hidden
              className="absolute top-[38px] right-0 left-0 hidden h-[2px] origin-left bg-gradient-to-r from-lavender via-lemon to-lavender sm:block"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "0px 0px -20% 0px" }}
              transition={{ duration: 1.4, ease: EASE }}
            />
            {STEPS.map((step, i) => (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -20% 0px" }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.25, ease: EASE }}
                className="relative"
              >
                <span className="font-display relative z-10 inline-flex size-[76px] items-center justify-center rounded-full border-2 border-lavender bg-background text-[30px] font-extrabold tracking-[-0.04em] text-brand">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display mt-6 text-[22px] font-bold tracking-[-0.02em]">{step.title}</h3>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-muted-foreground">{step.desc}</p>
              </motion.li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ========== FOR ORGANIZERS: bento of glowing cards ========== */}
      <section aria-labelledby="organizers-heading" className="relative overflow-hidden bg-[#111111] text-white">
        <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 size-[600px] rounded-full bg-lavender/25 blur-[140px]" />
        <div aria-hidden className="pointer-events-none absolute -right-40 -bottom-40 size-[500px] rounded-full bg-lemon/10 blur-[140px]" />
        <Container className="relative py-24 sm:py-32">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <Reveal>
              <p className="text-sm font-semibold text-lemon">For organizers</p>
              <h2 id="organizers-heading" className="font-display mt-3 max-w-[16ch] text-[36px] leading-[1.02] font-extrabold tracking-[-0.04em] sm:text-[56px]">
                Run the door, <span className="fx-gradient-text">not a spreadsheet</span>
              </h2>
              <p className="mt-5 max-w-[48ch] text-[16px] leading-relaxed text-white/65">
                Registrations, ticket types, payments, QR check-in, certificates and analytics for every event your club, college or company runs.
              </p>
            </Reveal>
            <Reveal delay={0.15} className="flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={ctaLemon}>
                Start organizing for free
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </Link>
              <Link
                href="/for-organizers"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-6 text-[15px] font-medium text-white transition-colors hover:border-lavender hover:bg-lavender/15"
              >
                Features for organizers
              </Link>
            </Reveal>
          </div>

          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, y: 40, rotateX: 18 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ duration: 0.8, delay: (i % 3) * 0.1, ease: EASE }}
                style={{ transformPerspective: 900 }}
                // zig-zag bento: wide cards at 0, 3, 5 fill three full rows on desktop
                className={cn((i === 0 || i === 3 || i === 5) && "lg:col-span-2")}
              >
                <Spotlight className="group h-full rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition-colors duration-300 hover:border-lavender/50">
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-2xl transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:scale-110 group-hover:rotate-6",
                      i % 2 === 0 ? "bg-lavender text-charcoal" : "bg-lemon text-lemon-ink",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="font-display mt-8 text-[22px] font-bold tracking-[-0.02em]">{title}</h3>
                  <p className="mt-2 max-w-[44ch] text-[15px] leading-relaxed text-white/60">{desc}</p>
                </Spotlight>
              </motion.li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ========== PRICING ========== */}
      <section aria-labelledby="pricing-heading">
        <Container className="py-24 sm:py-28">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <Reveal>
              <SectionTitle
                id="pricing-heading"
                kicker="Pricing"
                title="Start free, upgrade as you grow"
                description="No hidden fees. No credit card required, and free forever for basic use."
              />
            </Reveal>
            <Link href="/pricing" className={cn(ctaGhost, "h-11 shrink-0 max-sm:w-full")}>
              Compare all features
            </Link>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3 md:items-stretch">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: EASE }}
                whileHover={{ y: -6 }}
                className={cn("flex flex-col rounded-3xl border bg-card p-7", plan.popular && "fx-run-border border-transparent md:-my-3 md:py-10")}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-[20px] font-bold tracking-[-0.02em]">{plan.name}</h3>
                  {plan.popular && (
                    <span className="rounded-full bg-lemon px-3 py-1 text-[12px] font-semibold text-lemon-ink">Most popular</span>
                  )}
                </div>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-[48px] leading-none font-extrabold tracking-[-0.04em] tabular-nums">{plan.price}</span>
                  {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                </p>
                <ul className="mt-7 flex-1 space-y-3 text-[15px]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-lavender/20 text-brand">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={cn(plan.popular ? ctaLemon : ctaGhost, "mt-9 w-full")}>
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* ========== FINAL CALL TO ACTION ========== */}
      <section aria-labelledby="final-cta-heading">
        <Container className="pb-24 sm:pb-28">
          <Reveal>
            <div className="relative overflow-hidden rounded-[32px] bg-lemon px-6 py-16 text-center text-lemon-ink sm:px-12 sm:py-24">
              <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-lavender/60 blur-[80px]" />
              <div aria-hidden className="absolute -bottom-24 -left-24 size-72 rounded-full bg-white/60 blur-[80px]" />
              <h2 id="final-cta-heading" className="font-display relative mx-auto max-w-[14ch] text-[40px] leading-[0.98] font-extrabold tracking-[-0.045em] sm:text-[72px]">
                Your next event starts here.
              </h2>
              <p className="relative mx-auto mt-5 max-w-[44ch] text-[17px] leading-relaxed text-lemon-ink/75">
                Set up registration in minutes. Free for your first events, no card needed.
              </p>
              <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-charcoal px-7 text-[15px] font-semibold text-lemon transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Create a free account
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </Link>
                <Link
                  href="/events"
                  className="inline-flex h-12 items-center justify-center rounded-full border-2 border-charcoal/80 px-7 text-[15px] font-semibold transition-colors hover:bg-charcoal/10"
                >
                  Browse events
                </Link>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </MotionConfig>
  )
}

function SectionTitle({ id, kicker, title, description }: { id: string; kicker: string; title: string; description?: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-brand">
        <span className="h-[2px] w-6 rounded-full bg-lemon" aria-hidden />
        {kicker}
      </p>
      <h2 id={id} className="font-display mt-3 text-[32px] leading-[1.02] font-extrabold tracking-[-0.04em] sm:text-[48px]">
        {title}
      </h2>
      {description && <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  )
}

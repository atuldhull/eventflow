import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Container } from "@/components/marketing/layout"
import { Reveal, WordReveal } from "@/components/marketing/fx"
import { Highlighter, Kicker } from "@/components/marketing/kit"
import { ctaInk, heroTitle, sectionTitle } from "@/components/marketing/styles"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about EventFlow — the professional event management platform built for organizations.",
}

const OFFER = [
  "Intuitive event creation with a step-by-step builder",
  "Custom registration forms and smart workflows",
  "Integrated payments with Razorpay",
  "QR code check-in for event day operations",
  "Real-time analytics and performance dashboards",
  "Automated certificate generation and distribution",
]

export default function AboutPage() {
  return (
    <>
      {/* ========== INTRO ========== */}
      <header className="relative -mt-16 overflow-hidden pt-16">
        <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />
        <Container className="pt-14 pb-16 sm:pt-20 sm:pb-24">
          <Kicker>About EventFlow: professional event management</Kicker>
          <h1 className={cn(heroTitle, "mt-4 max-w-[22ch]")}>
            <WordReveal text="Event management," /> <Highlighter delay={0.5}>made simple.</Highlighter>
          </h1>
          <Reveal delay={0.35} y={16}>
            <p className="mt-8 max-w-[58ch] text-[19px] leading-[1.6] text-foreground/85 sm:text-[21px]">
              EventFlow is a modern event management platform built for universities, companies, and organizations. We make it effortless to create, manage, and
              discover professional events.
            </p>
          </Reveal>
        </Container>
      </header>

      {/* ========== MISSION: a pull quote on a lavender field ========== */}
      <section aria-labelledby="mission-heading" className="bg-lavender text-charcoal">
        <Container className="grid gap-8 py-20 sm:py-28 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
          <Reveal>
            <h2 id="mission-heading" className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-[2px] w-6 rounded-full bg-charcoal" aria-hidden />
              Our mission
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="font-display max-w-[24ch] text-[32px] leading-[1.08] font-bold tracking-[-0.035em] sm:text-[48px]">
              To democratize professional event management by providing powerful, easy-to-use tools that help organizers focus on what matters most: creating
              amazing experiences for their attendees.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* ========== WHAT WE OFFER: a numbered list in big type ========== */}
      <section aria-labelledby="offer-heading">
        <Container className="grid gap-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <Reveal className="lg:sticky lg:top-24 lg:h-fit">
            <Kicker>What we offer</Kicker>
            <h2 id="offer-heading" className={cn(sectionTitle, "mt-3 max-w-[12ch]")}>
              One place for the whole event
            </h2>
            <p className="mt-5 max-w-[40ch] text-[16px] leading-relaxed text-muted-foreground">
              From the first page to the last certificate.{" "}
              <Link href="/for-organizers" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">
                See how it works for organizers
              </Link>
              .
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <ol className="border-t-2 border-foreground">
              {OFFER.map((item, i) => (
                <li key={item} className="group flex items-baseline gap-5 border-b border-rule py-5 sm:gap-8">
                  <span className="font-display w-10 shrink-0 text-[15px] font-bold text-brand tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-display text-[22px] leading-snug font-bold tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-1 sm:text-[26px]">
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>
        </Container>
      </section>

      {/* ========== BUILT IN INDIA: charcoal bento ========== */}
      <section aria-labelledby="india-heading" className="bg-charcoal text-white">
        <Container className="py-20 sm:py-28">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Reveal className="h-full">
              <div className="flex h-full flex-col justify-between gap-10 rounded-3xl border border-white/10 bg-white/[0.03] p-7 sm:p-10">
                <Kicker onDark>Built in India</Kicker>
                <div>
                  <h2 id="india-heading" className="font-display max-w-[14ch] text-[36px] leading-[1.02] font-extrabold tracking-[-0.04em] sm:text-[52px]">
                    Made for Indian campuses and <span className="fx-gradient-text">companies</span>
                  </h2>
                  <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-white/65">
                    EventFlow is proudly built in India, designed for the unique needs of Indian universities, colleges, and companies. We support INR payments, Indian
                    phone numbers, and local event categories.
                  </p>
                </div>
              </div>
            </Reveal>
            <div className="grid gap-4">
              {[
                { big: "₹", label: "INR payments", tone: "bg-lemon text-lemon-ink" },
                { big: "+91", label: "Indian phone numbers", tone: "bg-lavender text-charcoal" },
                { big: "Cultural", label: "Local event categories", tone: "border border-white/15" },
              ].map((x, i) => (
                <Reveal key={x.label} delay={0.08 * (i + 1)}>
                  <div className={cn("flex items-center justify-between gap-6 rounded-3xl px-7 py-6", x.tone)}>
                    <span className="text-[17px] font-semibold">{x.label}</span>
                    <span aria-hidden className="font-display text-[44px] leading-none font-extrabold tracking-[-0.05em]">{x.big}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ========== CLOSE ========== */}
      <section aria-labelledby="about-cta-heading">
        <Container className="py-20 sm:py-28">
          <Reveal>
            <div className="relative overflow-hidden rounded-[32px] bg-lemon px-6 py-14 text-lemon-ink sm:px-12 sm:py-20">
              <div aria-hidden className="absolute -bottom-24 -left-24 size-72 rounded-full bg-lavender/60 blur-[80px]" />
              <div className="relative grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <h2 id="about-cta-heading" className="font-display max-w-[14ch] text-[40px] leading-[0.98] font-extrabold tracking-[-0.045em] sm:text-[64px]">
                  Ready to run your next event?
                </h2>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/signup" className={ctaInk}>
                    Join EventFlow today
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                  </Link>
                  <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-full border-2 border-charcoal/80 px-7 text-[15px] font-semibold transition-colors hover:bg-charcoal/10">
                    Say hello
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  )
}

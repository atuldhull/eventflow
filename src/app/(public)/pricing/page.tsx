import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, Minus, Plus, Sparkles } from "lucide-react"
import { Container } from "@/components/marketing/layout"
import { Marquee, Reveal, WordReveal } from "@/components/marketing/fx"
import { Highlighter, Kicker } from "@/components/marketing/kit"
import { ctaGhost, ctaInk, ctaLemon, heroTitle, sectionTitle } from "@/components/marketing/styles"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for event management. Start free, upgrade as you grow.",
}

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "/month",
    description: "Perfect for getting started",
    features: [
      { text: "5 events per month", included: true },
      { text: "100 participants per event", included: true },
      { text: "1 organization", included: true },
      { text: "5 team members", included: true },
      { text: "Basic event pages", included: true },
      { text: "QR check-in", included: true },
      { text: "Basic analytics", included: true },
      { text: "Email notifications", included: true },
      { text: "Certificate generation", included: true },
      { text: "Custom branding", included: false },
      { text: "Priority support", included: false },
      { text: "API access", included: false },
    ],
    cta: "Get Started Free",
    href: "/signup",
  },
  {
    name: "Pro",
    price: "₹999",
    period: "/month",
    yearlyPrice: "₹9,999/year",
    description: "For growing organizations",
    popular: true,
    features: [
      { text: "Unlimited events", included: true },
      { text: "5,000 participants per event", included: true },
      { text: "5 organizations", included: true },
      { text: "25 team members", included: true },
      { text: "Custom branding", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Priority email support", included: true },
      { text: "Coupon codes", included: true },
      { text: "Custom registration forms", included: true },
      { text: "Data export (CSV)", included: true },
      { text: "SMS notifications", included: true },
      { text: "Custom domain", included: false },
    ],
    cta: "Start Free Trial",
    href: "/signup?plan=pro",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    features: [
      { text: "Unlimited everything", included: true },
      { text: "Unlimited participants", included: true },
      { text: "Unlimited organizations", included: true },
      { text: "Custom domain", included: true },
      { text: "White-label solution", included: true },
      { text: "API access + webhooks", included: true },
      { text: "SSO integration", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "SLA guarantee", included: true },
      { text: "Custom integrations", included: true },
      { text: "On-premise option", included: true },
      { text: "Priority phone support", included: true },
    ],
    cta: "Contact Sales",
    href: "/contact",
  },
]

/** sentence case for the call-to-action labels kept in the plan data */
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/**
 * The plans side by side, built only from what the plan lists above say
 * (a higher plan keeps what a lower one includes; API keys on Pro per the developer docs).
 * true = included, false = not included, a string = the plan's own wording.
 */
type Cell = boolean | string
const COMPARE: { group: string; rows: { label: string; cells: [Cell, Cell, Cell] }[] }[] = [
  {
    group: "Limits",
    rows: [
      { label: "Events", cells: ["5 per month", "Unlimited", "Unlimited"] },
      { label: "Participants per event", cells: ["100", "5,000", "Unlimited"] },
      { label: "Organizations", cells: ["1", "5", "Unlimited"] },
      { label: "Team members", cells: ["5", "25", "Unlimited"] },
    ],
  },
  {
    group: "Running events",
    rows: [
      { label: "Event pages", cells: ["Basic", "Custom branding", "White-label"] },
      { label: "QR check-in", cells: [true, true, true] },
      { label: "Certificate generation", cells: [true, true, true] },
      { label: "Coupon codes", cells: [false, true, true] },
      { label: "Custom registration forms", cells: [false, true, true] },
      { label: "Data export (CSV)", cells: [false, true, true] },
      { label: "Analytics", cells: ["Basic", "Advanced", "Advanced"] },
      { label: "Notifications", cells: ["Email", "Email and SMS", "Email and SMS"] },
    ],
  },
  {
    group: "Platform",
    rows: [
      { label: "Custom branding", cells: [false, true, true] },
      { label: "Custom domain", cells: [false, false, true] },
      { label: "API access", cells: [false, true, "API + webhooks"] },
      { label: "SSO integration", cells: [false, false, true] },
      { label: "Custom integrations", cells: [false, false, true] },
      { label: "On-premise option", cells: [false, false, true] },
    ],
  },
  {
    group: "Support",
    rows: [
      { label: "Support", cells: ["Email", "Priority email", "Priority phone"] },
      { label: "Dedicated account manager", cells: [false, false, true] },
      { label: "SLA guarantee", cells: [false, false, true] },
    ],
  },
]

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is the Free plan really free?",
    a: <>Yes. It costs ₹0 a month and you don&apos;t need a card to sign up. You can run 5 events a month with up to 100 participants each.</>,
  },
  {
    q: "How much does yearly billing save on Pro?",
    a: <>Pro is ₹999 a month, or ₹9,999 if you pay for the year. That is about 17% less than twelve monthly payments.</>,
  },
  {
    q: "How do attendees pay for tickets?",
    a: <>Through Razorpay: UPI, cards and netbanking. EventFlow never sees card or UPI details.</>,
  },
  {
    q: "Can attendees get their money back?",
    a: (
      <>
        The organizer of each event decides whether its tickets can be refunded, and paid tickets are refunded if the organizer cancels the event. The details are in
        our <Link href="/refunds" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">refund policy</Link>.
      </>
    ),
  },
  {
    q: "Can I connect EventFlow to my own systems?",
    a: (
      <>
        Yes, with the REST API and webhooks. Have a look at the <Link href="/developers" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">developer hub</Link> for the endpoints and scopes.
      </>
    ),
  },
  {
    q: "What does an Enterprise plan cost?",
    a: (
      <>
        It depends on your setup: how many organizations, whether you need SSO, a custom domain, white-label or an on-premise option. <Link href="/contact" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">Tell us what you need</Link> and we&apos;ll send a quote.
      </>
    ),
  },
]

export default function PricingPage() {
  return (
    <>
      {/* ========== HEADLINE ========== */}
      <header className="relative -mt-16 overflow-hidden pt-16">
        <div aria-hidden className="fx-grid pointer-events-none absolute inset-0 -z-10" />
        <Container className="pt-14 pb-12 sm:pt-20 sm:pb-16">
          <Kicker>Simple, transparent pricing</Kicker>
          <h1 className={cn(heroTitle, "mt-4 max-w-[13ch] lg:max-w-none")}>
            <WordReveal text="Pricing that starts at" />{" "}
            <Highlighter delay={0.55}>₹0</Highlighter>
          </h1>
          <Reveal delay={0.4} y={16}>
            <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-muted-foreground">Start free, upgrade as you grow. No hidden fees.</p>
          </Reveal>
        </Container>
      </header>

      {/* ========== PLANS: three bold columns ========== */}
      <section aria-label="Plans">
        <Container className="pb-16 sm:pb-20">
          <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
            {plans.map((plan, i) => {
              const enterprise = plan.name === "Enterprise"
              return (
                <Reveal key={plan.name} delay={i * 0.1} className="h-full">
                  <section
                    aria-labelledby={`plan-${plan.name}`}
                    className={cn(
                      "flex h-full flex-col rounded-[28px] p-7 sm:p-8",
                      plan.popular && "fx-run-border shadow-[0_30px_80px_-30px_var(--lavender)] lg:-my-4 lg:py-12",
                      !plan.popular && !enterprise && "border bg-card",
                      enterprise && "bg-charcoal text-white dark:border dark:border-white/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2 id={`plan-${plan.name}`} className="font-display text-[24px] font-bold tracking-[-0.02em]">{plan.name}</h2>
                      {plan.popular && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-3 py-1 text-[12px] font-semibold text-lemon-ink">
                          <Sparkles className="size-3.5" aria-hidden /> Most popular
                        </span>
                      )}
                    </div>
                    <p className={cn("mt-1 text-[15px]", enterprise ? "text-white/65" : "text-muted-foreground")}>{plan.description}</p>

                    <p className="mt-8 flex items-baseline gap-1.5">
                      <span className="font-display text-[64px] leading-[0.9] font-extrabold tracking-[-0.05em] tabular-nums sm:text-[76px]">{plan.price}</span>
                      {plan.period && <span className={cn("text-[15px]", enterprise ? "text-white/65" : "text-muted-foreground")}>{plan.period}</span>}
                    </p>
                    {/* the line is kept on every plan so the buttons align across the row */}
                    <p className={cn("mt-3 h-5 text-[13px] tabular-nums", enterprise ? "text-white/65" : "text-muted-foreground")}>
                      {plan.yearlyPrice && (
                        <>
                          or <span className="font-semibold text-foreground">{plan.yearlyPrice}</span>, save 17%
                        </>
                      )}
                    </p>

                    <Link
                      href={plan.href}
                      className={cn(
                        plan.popular ? ctaLemon : enterprise ? "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lavender px-6 text-[15px] font-semibold text-charcoal transition-transform duration-300 hover:-translate-y-0.5" : ctaGhost,
                        "mt-7 w-full shrink-0",
                      )}
                    >
                      {sentence(plan.cta)}
                      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                    </Link>

                    <ul className={cn("mt-8 flex-1 space-y-3 border-t pt-7 text-[15px]", enterprise ? "border-white/10" : "border-rule")}>
                      {plan.features.map((f) => (
                        <li key={f.text} className="flex items-start gap-3">
                          {f.included ? (
                            <span
                              className={cn(
                                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                                enterprise ? "bg-lavender text-charcoal" : plan.popular ? "bg-lemon text-lemon-ink" : "bg-lavender/20 text-brand",
                              )}
                            >
                              <Check className="size-3.5" strokeWidth={3} aria-hidden />
                            </span>
                          ) : (
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-faint">
                              <Minus className="size-3" strokeWidth={3} aria-hidden />
                            </span>
                          )}
                          <span className={cn(!f.included && (enterprise ? "text-white/50" : "text-muted-foreground line-through decoration-faint/60"))}>
                            {f.text}
                            {!f.included && <span className="sr-only"> (not included)</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </Reveal>
              )
            })}
          </div>
        </Container>
      </section>

      {/* ========== BAND ========== */}
      <section className="overflow-hidden py-10">
        <p className="sr-only">All plans include SSL security and free updates.</p>
        <div aria-hidden className="-rotate-[1.5deg] bg-lemon py-4 text-lemon-ink">
          <Marquee speed={40}>
            {["All plans include SSL security", "Free updates", "No hidden fees", "Start free", "Upgrade as you grow"].map((w) => (
              <span key={w} className="font-display flex items-center gap-8 px-4 text-[24px] font-extrabold tracking-[-0.03em] sm:text-[30px]">
                {w}
                <Sparkles className="size-5 shrink-0" />
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ========== COMPARISON ========== */}
      <section aria-labelledby="compare-heading">
        <Container className="py-16 sm:py-24">
          <Reveal>
            <Kicker>Side by side</Kicker>
            <h2 id="compare-heading" className={cn(sectionTitle, "mt-3")}>
              Compare every plan
            </h2>
          </Reveal>

          <div className="relative mt-10 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[15px]">
              <caption className="sr-only">Features and limits of the Free, Pro and Enterprise plans</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[34%] border-b-2 border-foreground bg-background py-4 pr-4 text-left align-bottom text-[13px] font-medium text-muted-foreground">
                    Feature
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.name}
                      scope="col"
                      className={cn(
                        "border-b-2 border-foreground px-4 py-4 text-left align-bottom",
                        plan.popular ? "rounded-t-2xl bg-lemon text-lemon-ink" : "bg-background",
                      )}
                    >
                      <span className="font-display block text-[20px] font-bold tracking-[-0.02em]">{plan.name}</span>
                      <span className={cn("block text-[13px] font-normal tabular-nums", plan.popular ? "text-lemon-ink/75" : "text-muted-foreground")}>
                        {plan.price}
                        {plan.period}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              {COMPARE.map((group) => (
                <tbody key={group.group}>
                  <tr>
                    <th scope="colgroup" colSpan={4} className="font-display border-b border-rule pt-8 pb-3 text-left text-[13px] font-bold tracking-[0.08em] text-brand uppercase">
                      {group.group}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} className="group">
                      <th scope="row" className="border-b border-rule py-3.5 pr-4 text-left font-normal group-hover:bg-raised/60">
                        {row.label}
                      </th>
                      {row.cells.map((cell, i) => (
                        <td key={i} className={cn("border-b border-rule px-4 py-3.5 tabular-nums group-hover:bg-raised/60", plans[i].popular && "bg-lavender/[0.07]")}>
                          {cell === true ? (
                            <>
                              <Check className="size-5 text-brand" strokeWidth={2.5} aria-hidden />
                              <span className="sr-only">Included</span>
                            </>
                          ) : cell === false ? (
                            <>
                              <Minus className="size-4 text-faint" aria-hidden />
                              <span className="sr-only">Not included</span>
                            </>
                          ) : (
                            <span className="font-medium">{cell}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </Container>
      </section>

      {/* ========== FAQ: questions left, answers open in place ========== */}
      <section aria-labelledby="faq-heading" className="border-t border-rule">
        <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <Reveal className="lg:sticky lg:top-24 lg:h-fit">
            <Kicker>Questions</Kicker>
            <h2 id="faq-heading" className={cn(sectionTitle, "mt-3 max-w-[12ch]")}>
              Before you <Highlighter delay={0.3}>pick a plan</Highlighter>
            </h2>
            <p className="mt-5 max-w-[40ch] text-[16px] leading-relaxed text-muted-foreground">
              Something else on your mind?{" "}
              <Link href="/contact" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">
                Write to us
              </Link>
              .
            </p>
          </Reveal>
          <div className="border-t-2 border-foreground">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-rule">
                <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
                  <span className="font-display text-[19px] leading-snug font-bold tracking-[-0.015em] sm:text-[22px]">{item.q}</span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 transition-[transform,background-color] duration-300 group-open:rotate-45 group-open:border-transparent group-open:bg-lemon group-open:text-lemon-ink">
                    <Plus className="size-4" aria-hidden />
                  </span>
                </summary>
                <p className="max-w-[60ch] pb-6 text-[16px] leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* ========== CLOSE ========== */}
      <section aria-labelledby="pricing-cta-heading">
        <Container className="pb-20 sm:pb-28">
          <Reveal>
            <div className="relative overflow-hidden rounded-[32px] bg-lemon px-6 py-14 text-lemon-ink sm:px-12 sm:py-20">
              <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-lavender/60 blur-[80px]" />
              <div className="relative grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <h2 id="pricing-cta-heading" className="font-display max-w-[14ch] text-[40px] leading-[0.98] font-extrabold tracking-[-0.045em] sm:text-[64px]">
                  Run your first event for ₹0.
                </h2>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/signup" className={ctaInk}>
                    {sentence(plans[0].cta)}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                  </Link>
                  <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-full border-2 border-charcoal/80 px-7 text-[15px] font-semibold transition-colors hover:bg-charcoal/10">
                    Talk to us
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

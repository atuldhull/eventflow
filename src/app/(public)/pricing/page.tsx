import type { Metadata } from "next"
import Link from "next/link"
import { Check, Minus } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Container, PageIntro } from "@/components/marketing/layout"
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

export default function PricingPage() {
  return (
    <>
      <PageIntro title="Simple, transparent pricing" description="Start free, upgrade as you grow. No hidden fees." />

      <Container className="py-12 sm:py-16">
        {/* one row of plans; the recommended one is marked by an ink border, not colour */}
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <section
              key={plan.name}
              aria-labelledby={`plan-${plan.name}`}
              className={cn("flex flex-col rounded-lg border bg-card", plan.popular && "border-foreground ring-1 ring-foreground")}
            >
              <div className="border-b border-rule p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id={`plan-${plan.name}`} className="text-[17px] font-semibold">{plan.name}</h2>
                  {plan.popular && <span className="text-[13px] text-muted-foreground">Most popular</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-[36px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{plan.price}</span>
                  {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                </p>
                {/* the line is kept on every plan so the buttons align across the row */}
                <p className="mt-2 h-5 text-[13px] text-muted-foreground tabular-nums">
                  {plan.yearlyPrice && `or ${plan.yearlyPrice}, save 17%`}
                </p>
                <Link
                  href={plan.href}
                  className={cn(buttonVariants({ variant: plan.popular ? "default" : "outline", size: "lg" }), "mt-6 w-full")}
                >
                  {sentence(plan.cta)}
                </Link>
              </div>

              <ul className="flex-1 space-y-3 p-6 text-sm">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5">
                    {f.included ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                    ) : (
                      <Minus className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
                    )}
                    <span className={cn(!f.included && "text-muted-foreground")}>
                      {f.text}
                      {!f.included && <span className="sr-only"> (not included)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">All plans include SSL security and free updates.</p>
      </Container>
    </>
  )
}

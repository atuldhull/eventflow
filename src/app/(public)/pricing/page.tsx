import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Pricing | EventFlow",
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

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16 space-y-16">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">Simple, Transparent Pricing</h1>
        <p className="text-muted-foreground max-w-md mx-auto">Start free, upgrade as you grow. No hidden fees.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3 max-w-5xl mx-auto">
        {plans.map((plan) => (
          <Card key={plan.name} className={cn("p-6 space-y-6 relative", plan.popular && "border-primary shadow-lg scale-105")}>
            {plan.popular && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">Most Popular</Badge>}
            <div>
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
              <p className="text-3xl font-bold mt-2">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.period}</span></p>
              {plan.yearlyPrice && <p className="text-xs text-muted-foreground mt-1">{plan.yearlyPrice} — save 17%</p>}
            </div>
            <ul className="space-y-2.5">
              {plan.features.map((f) => (
                <li key={f.text} className="flex items-start gap-2 text-sm">
                  {f.included ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                  )}
                  <span className={cn(!f.included && "text-muted-foreground")}>{f.text}</span>
                </li>
              ))}
            </ul>
            <Link href={plan.href} className={cn(buttonVariants({ variant: plan.popular ? "default" : "outline" }), "w-full")}>
              {plan.cta}
            </Link>
          </Card>
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        All plans include SSL security, 99.9% uptime, and free updates.
      </div>
    </div>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { LayoutTemplate, FormInput, CreditCard, ScanLine, BarChart3, Award, ArrowRight, Building2, GraduationCap, Users, Heart } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Container, SectionHeader } from "@/components/marketing/layout"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "For Organizers",
  description: "Create, manage, and grow professional events with EventFlow. Built for universities, companies, and organizations.",
}

const FEATURES = [
  { icon: LayoutTemplate, title: "Event pages", desc: "Create event pages with a step-by-step builder. Customize branding, add schedules, sponsors, and FAQs." },
  { icon: FormInput, title: "Smart registration", desc: "Custom registration forms, team registration, approval workflows, waitlists, and CSV import/export." },
  { icon: CreditCard, title: "Seamless payments", desc: "Accept payments via Razorpay (UPI, cards, netbanking). Multiple ticket types, coupon codes, and refunds that sync back from Razorpay automatically." },
  { icon: ScanLine, title: "QR check-in", desc: "Scan and go. Real-time attendance tracking with multiple scanners and offline support." },
  { icon: BarChart3, title: "Analytics", desc: "Track registrations, revenue, attendance rates, and more with detailed dashboards." },
  { icon: Award, title: "Certificates", desc: "Auto-generate and distribute professional certificates with customizable templates." },
]

const AUDIENCES = [
  { icon: GraduationCap, title: "Universities", desc: "Manage fests, workshops, and club events" },
  { icon: Building2, title: "Companies", desc: "Corporate events, conferences, team activities" },
  { icon: Users, title: "Communities", desc: "Meetups, hackathons, open events" },
  { icon: Heart, title: "NGOs", desc: "Fundraisers, awareness events, volunteer drives" },
]

export default function ForOrganizersPage() {
  return (
    <>
      {/* Intro */}
      <header className="border-b border-rule">
        <Container className="grid gap-8 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16">
          <div>
            <h1 className="max-w-[18ch] text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[44px]">Your events, simplified</h1>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-muted-foreground">
              Everything you need to create, manage, and grow professional events — from the first registration to the certificate.
            </p>
          </div>
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "px-5 max-sm:w-full")}>
            Start organizing for free <ArrowRight aria-hidden />
          </Link>
        </Container>
      </header>

      {/* Features */}
      <section aria-labelledby="features-heading">
        <Container className="py-16 sm:py-20">
          <SectionHeader id="features-heading" title="What you get" description="One place for every step of an event, for every event you run." />
          <ul className="mt-10 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="border-t border-rule py-6">
                <Icon className="size-5 text-foreground" strokeWidth={1.5} aria-hidden />
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Built for */}
      <section aria-labelledby="audiences-heading" className="border-t border-rule">
        <Container className="py-16 sm:py-20">
          <SectionHeader id="audiences-heading" title="Built for everyone" />
          <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="bg-background p-6">
                <Icon className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                <h3 className="mt-6 text-[15px] font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Close */}
      <section aria-labelledby="cta-heading">
        <Container className="pb-16 sm:pb-24">
          <div className="flex flex-col gap-6 rounded-2xl bg-frame p-8 sm:p-12 md:flex-row md:items-center md:justify-between dark:border dark:border-border">
            <div>
              <h2 id="cta-heading" className="text-[22px] leading-tight font-semibold tracking-[-0.015em] sm:text-[28px]">Ready to get started?</h2>
              <p className="mt-2 text-[15px] text-muted-foreground">Create your free account and start organizing events today.</p>
            </div>
            <Link href="/signup" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "shrink-0 px-5")}>
              Create free account <ArrowRight aria-hidden />
            </Link>
          </div>
        </Container>
      </section>
    </>
  )
}

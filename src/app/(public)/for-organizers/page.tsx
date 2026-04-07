import type { Metadata } from "next"
import Link from "next/link"
import { Layout, FormInput, CreditCard, ScanLine, BarChart3, Award, CheckCircle, ArrowRight, Building2, GraduationCap, Users, Heart } from "lucide-react"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "For Organizers | EventFlow",
  description: "Create, manage, and grow professional events with EventFlow. Built for universities, companies, and organizations.",
}

export default function ForOrganizersPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-linear-to-br from-zinc-900 to-zinc-800 text-white py-24">
        <div className="container mx-auto px-4 text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold">Your Events, Simplified</h1>
          <p className="text-lg text-zinc-300 max-w-2xl mx-auto">Everything you need to create, manage, and grow professional events</p>
          <div className="flex justify-center gap-4">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>Start Organizing for Free <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-2 max-w-5xl mx-auto">
          {[
            { icon: Layout, title: "Beautiful Event Pages", desc: "Create stunning event pages with our intuitive step-by-step builder. Customize branding, add schedules, sponsors, and FAQs." },
            { icon: FormInput, title: "Smart Registration", desc: "Custom registration forms, team registration, approval workflows, waitlists, and CSV import/export." },
            { icon: CreditCard, title: "Seamless Payments", desc: "Accept payments via Razorpay and Stripe. Multiple ticket types, coupon codes, and automated refunds." },
            { icon: ScanLine, title: "QR Check-in", desc: "Scan and go. Real-time attendance tracking with multiple scanners and offline support." },
            { icon: BarChart3, title: "Powerful Analytics", desc: "Track registrations, revenue, attendance rates, and more with detailed visual dashboards." },
            { icon: Award, title: "Certificate Generation", desc: "Auto-generate and distribute professional certificates with customizable templates." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Built For */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Built For Everyone</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
            {[
              { icon: GraduationCap, title: "Universities", desc: "Manage fests, workshops, and club events" },
              { icon: Building2, title: "Companies", desc: "Corporate events, conferences, team activities" },
              { icon: Users, title: "Communities", desc: "Meetups, hackathons, open events" },
              { icon: Heart, title: "NGOs", desc: "Fundraisers, awareness events, volunteer drives" },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="p-6 text-center">
                <Icon className="h-8 w-8 mx-auto text-primary mb-3" />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center space-y-6">
        <h2 className="text-3xl font-bold">Ready to get started?</h2>
        <p className="text-muted-foreground">Create your free account and start organizing events today.</p>
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>Create Free Account <ArrowRight className="h-4 w-4" /></Link>
      </section>
    </div>
  )
}

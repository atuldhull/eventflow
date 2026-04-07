import Link from "next/link"
import { ArrowRight, Calendar, ClipboardCheck, PartyPopper, Layout, FormInput, CreditCard, ScanLine, BarChart3, Award, Code, Palette, Trophy, GraduationCap, Users, BookOpen, Monitor, Braces, CheckCircle } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { FeaturedEvents } from "@/components/events/FeaturedEvents"

export default function LandingPage() {
  return (
    <div className="-mt-16">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center bg-linear-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.15),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(74,222,128,0.1),transparent_50%)]" />
        <div className="relative container mx-auto px-4 py-20 text-center space-y-8">
          <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
            Trusted by 100+ organizations
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-tight">
            Events Made{" "}
            <span className="bg-linear-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
              Effortless
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            The all-in-one platform to create, manage, and discover professional events.
            Built for universities, companies, and organizations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/events" className={cn(buttonVariants({ size: "lg" }), "gap-2 text-base px-8")}>
              Explore Events <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "text-base px-8 border-white/30 text-white hover:bg-white/10")}>
              Start Organizing
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Find Events by Category</h2>
          <p className="text-muted-foreground mt-2">Discover events that match your interests</p>
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { icon: Code, label: "Tech", color: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400" },
            { icon: Palette, label: "Cultural", color: "bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400" },
            { icon: Trophy, label: "Sports", color: "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400" },
            { icon: GraduationCap, label: "Workshop", color: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400" },
            { icon: Braces, label: "Hackathon", color: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400" },
            { icon: Users, label: "Conference", color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400" },
            { icon: BookOpen, label: "Seminar", color: "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400" },
            { icon: Monitor, label: "Webinar", color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400" },
            { icon: Award, label: "Competition", color: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400" },
            { icon: Calendar, label: "More", color: "bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
          ].map(({ icon: Icon, label, color }) => (
            <Link key={label} href={`/events?category=${label.toUpperCase()}`}>
              <Card className={cn("p-6 text-center hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer", color)}>
                <Icon className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm font-medium">{label}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured / Upcoming Events */}
      <FeaturedEvents />

      {/* How It Works */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">How It Works</h2>
            <p className="text-muted-foreground mt-2">Get started in three simple steps</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3 max-w-3xl mx-auto">
            {[
              { step: 1, icon: Calendar, title: "Discover", desc: "Browse events across categories and locations" },
              { step: 2, icon: ClipboardCheck, title: "Register", desc: "Sign up in seconds with a simple form" },
              { step: 3, icon: PartyPopper, title: "Attend", desc: "Show your QR ticket and enjoy the event" },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground mx-auto text-sm font-bold">
                  {step}
                </div>
                <Icon className="h-6 w-6 mx-auto text-primary" />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Everything You Need</h2>
          <p className="text-muted-foreground mt-2">Powerful tools for event organizers</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Layout, title: "Event Builder", desc: "Create beautiful event pages with our intuitive step-by-step builder" },
            { icon: FormInput, title: "Smart Registration", desc: "Custom forms, team registration, approval workflows, and waitlists" },
            { icon: CreditCard, title: "Payments & Tickets", desc: "Accept payments via Razorpay/Stripe. Generate digital tickets with QR codes" },
            { icon: ScanLine, title: "QR Check-in", desc: "Scan QR codes at the venue. Real-time attendance tracking" },
            { icon: BarChart3, title: "Analytics", desc: "Track registrations, revenue, attendance with detailed dashboards" },
            { icon: Award, title: "Certificates", desc: "Auto-generate and distribute certificates to participants" },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-6 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-zinc-950 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 grid-cols-2 lg:grid-cols-4 text-center">
            {[
              { value: "10,000+", label: "Events Created" },
              { value: "500,000+", label: "Registrations" },
              { value: "100+", label: "Organizations" },
              { value: "4.8/5", label: "Average Rating" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-3xl sm:text-4xl font-bold">{value}</p>
                <p className="text-sm text-zinc-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground mt-2">Start free, upgrade as you grow</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto pt-4">
          {[
            { name: "Free", price: "₹0", period: "/month", features: ["5 events/month", "100 participants", "Basic analytics", "Email support"], cta: "Get Started", href: "/signup" },
            { name: "Pro", price: "₹999", period: "/month", features: ["Unlimited events", "5,000 participants", "Advanced analytics", "Custom branding", "Priority support"], cta: "Start Free Trial", href: "/signup?plan=pro", popular: true },
            { name: "Enterprise", price: "Custom", period: "", features: ["Unlimited everything", "White-label", "SSO integration", "Dedicated support", "API access"], cta: "Contact Sales", href: "/contact" },
          ].map((plan) => (
            <Card key={plan.name} className={cn("p-6 space-y-4 relative overflow-visible", plan.popular && "border-primary shadow-lg")}>
              {plan.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">Most Popular</Badge>}
              <div>
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="text-3xl font-bold mt-1">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.period}</span></p>
              </div>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.href} className={cn(buttonVariants({ variant: plan.popular ? "default" : "outline" }), "w-full")}>
                {plan.cta}
              </Link>
            </Card>
          ))}
        </div>
        <div className="text-center mt-6">
          <Link href="/pricing" className="text-sm text-primary hover:underline">
            Compare all features →
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-linear-to-r from-primary to-primary/80 text-primary-foreground py-16">
        <div className="container mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl font-bold">Ready to Create Your Next Event?</h2>
          <p className="text-primary-foreground/80 max-w-md mx-auto">
            Join thousands of organizers who trust EventFlow
          </p>
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-white text-primary hover:bg-white/90 text-base px-8")}>
            Get Started for Free
          </Link>
          <p className="text-xs text-primary-foreground/60">No credit card required</p>
        </div>
      </section>
    </div>
  )
}

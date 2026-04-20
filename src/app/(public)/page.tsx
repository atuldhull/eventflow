"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import { motion, useScroll, useTransform, useInView } from "framer-motion"
import { ArrowRight, Calendar, ClipboardCheck, PartyPopper, Layout, FormInput, CreditCard, ScanLine, BarChart3, Award, Code, Palette, Trophy, GraduationCap, Users, BookOpen, Monitor, Braces, CheckCircle, Sparkles, Zap, Shield } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { FeaturedEvents } from "@/components/events/FeaturedEvents"
import { MeshGradient } from "@/components/motion/MeshGradient"

// Reusable animated section wrapper
function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay, ease: [0.25, 0.4, 0.25, 1] }} className={className}>
      {children}
    </motion.div>
  )
}

// Animated counter
function Counter({ target, suffix = "" }: { target: string; suffix?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  return (
    <motion.span ref={ref} initial={{ opacity: 0, scale: 0.5 }} animate={isInView ? { opacity: 1, scale: 1 } : {}} transition={{ type: "spring", stiffness: 100, delay: 0.2 }}>
      {target}{suffix}
    </motion.span>
  )
}

export default function LandingPage() {
  const [stats, setStats] = useState({ events: 0, registrations: 0, organizations: 0 })

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats")
        const json = await res.json()
        if (json.success) setStats(json.data)
      } catch {}
    }
    fetchStats()
  }, [])

  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <div className="-mt-16">
      {/* ========== HERO ========== */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-950">
        {/* WebGL mesh-gradient background — replaces the framer-motion orbs for lower CPU + richer colour transitions. */}
        <MeshGradient palette="night" opacity={0.85} className="mix-blend-screen" />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-white/20"
            style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
            animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
          />
        ))}

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative container mx-auto px-4 py-20 text-center z-10">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
            <Badge className="bg-white/5 text-white/80 border-white/10 backdrop-blur-sm gap-1.5 px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Open-source Event Management Platform
            </Badge>
          </motion.div>

          {/* Main heading */}
          <motion.h1 className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight max-w-5xl mx-auto leading-[1.1] text-white"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}>
            Events Made{" "}
            <span className="relative">
              <span className="bg-linear-to-r from-violet-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Effortless
              </span>
              <motion.span className="absolute -bottom-2 left-0 right-0 h-1 bg-linear-to-r from-violet-400 via-blue-400 to-emerald-400 rounded-full"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.2, duration: 0.8, ease: "easeOut" }}
                style={{ originX: 0 }}
              />
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.7 }}>
            The all-in-one platform to create, manage, and discover professional events.
            Built for universities, companies, and organizations of every size.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6 }}>
            <Link href="/events" className={cn(buttonVariants({ size: "lg" }), "gap-2 text-base px-8 h-12 rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow")}>
              Explore Events <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "text-base px-8 h-12 rounded-xl border-white/20 text-white hover:bg-white/10 backdrop-blur-sm")}>
              Start Organizing
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div className="mt-12 flex items-center justify-center gap-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.8 }}>
            <div className="flex -space-x-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-9 h-9 rounded-full border-2 border-zinc-950 bg-linear-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <p className="text-sm text-zinc-500">
              Start creating events today
            </p>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
            <motion.div className="w-1.5 h-1.5 rounded-full bg-white/60"
              animate={{ y: [0, 16, 0] }} transition={{ duration: 2, repeat: Infinity }} />
          </div>
        </motion.div>
      </section>

      {/* ========== CATEGORIES ========== */}
      <section className="container mx-auto px-4 py-24">
        <AnimatedSection className="text-center mb-14">
          <p className="text-sm font-medium text-primary mb-2 tracking-wider uppercase">Explore</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Find Events by Category</h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">Discover events that match your interests across every domain</p>
        </AnimatedSection>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { icon: Code, label: "Tech", color: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700" },
            { icon: Palette, label: "Cultural", color: "bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400 hover:border-pink-300" },
            { icon: Trophy, label: "Sports", color: "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400 hover:border-green-300" },
            { icon: GraduationCap, label: "Workshop", color: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 hover:border-amber-300" },
            { icon: Braces, label: "Hackathon", color: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 hover:border-purple-300" },
            { icon: Users, label: "Conference", color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 hover:border-indigo-300" },
            { icon: BookOpen, label: "Seminar", color: "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400 hover:border-teal-300" },
            { icon: Monitor, label: "Webinar", color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400 hover:border-cyan-300" },
            { icon: Award, label: "Competition", color: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 hover:border-orange-300" },
            { icon: Calendar, label: "More", color: "bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:border-zinc-400" },
          ].map(({ icon: Icon, label, color }, i) => (
            <AnimatedSection key={label} delay={i * 0.05}>
              <Link href={`/events?category=${label.toUpperCase()}`}>
                <Card className={cn("p-6 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer border-2 border-transparent", color)}>
                  <motion.div whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }} transition={{ duration: 0.4 }}>
                    <Icon className="h-8 w-8 mx-auto mb-2" />
                  </motion.div>
                  <p className="text-sm font-medium">{label}</p>
                </Card>
              </Link>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* Featured Events */}
      <FeaturedEvents />

      {/* ========== HOW IT WORKS ========== */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-14">
            <p className="text-sm font-medium text-primary mb-2 tracking-wider uppercase">Simple Process</p>
            <h2 className="text-3xl sm:text-4xl font-bold">How It Works</h2>
            <p className="text-muted-foreground mt-3">Get started in three simple steps</p>
          </AnimatedSection>
          <div className="grid gap-8 sm:grid-cols-3 max-w-4xl mx-auto">
            {[
              { step: 1, icon: Calendar, title: "Discover", desc: "Browse events across categories and locations", gradient: "from-blue-500 to-cyan-500" },
              { step: 2, icon: ClipboardCheck, title: "Register", desc: "Sign up in seconds with a simple, customizable form", gradient: "from-violet-500 to-purple-500" },
              { step: 3, icon: PartyPopper, title: "Attend", desc: "Show your QR ticket at the venue and enjoy", gradient: "from-emerald-500 to-teal-500" },
            ].map(({ step, icon: Icon, title, desc, gradient }, i) => (
              <AnimatedSection key={step} delay={i * 0.15} className="relative">
                {i < 2 && <div className="hidden sm:block absolute top-10 left-[60%] w-[80%] h-px bg-linear-to-r from-border to-transparent" />}
                <div className="text-center space-y-4">
                  <motion.div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br text-white mx-auto shadow-lg", gradient)}
                    whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Icon className="h-6 w-6" />
                  </motion.div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Step {step}</div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FEATURES ========== */}
      <section className="container mx-auto px-4 py-24">
        <AnimatedSection className="text-center mb-14">
          <p className="text-sm font-medium text-primary mb-2 tracking-wider uppercase">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Everything You Need</h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto">Powerful tools for organizers, seamless experience for attendees</p>
        </AnimatedSection>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Layout, title: "Event Builder", desc: "Create beautiful event pages with our intuitive 6-step wizard. Support for single, multi-day, virtual, hybrid, and recurring events.", gradient: "from-blue-500 to-indigo-500" },
            { icon: FormInput, title: "Smart Registration", desc: "12 custom field types, team registration, guest checkout, email domain restrictions, and approval workflows.", gradient: "from-violet-500 to-purple-500" },
            { icon: CreditCard, title: "Payments & Tickets", desc: "Razorpay integration, coupons, dynamic pricing, ticket transfer, add-ons, and GST-compliant invoices.", gradient: "from-emerald-500 to-green-500" },
            { icon: ScanLine, title: "QR Check-in", desc: "Real-time QR scanning with offline support, undo check-in, manual search, and multi-device capability.", gradient: "from-orange-500 to-red-500" },
            { icon: BarChart3, title: "Analytics", desc: "Registration funnels, revenue breakdown, attendance rates, geographic distribution, and exportable reports.", gradient: "from-cyan-500 to-blue-500" },
            { icon: Shield, title: "Enterprise Grade", desc: "Multi-tenant hierarchy, 9-role RBAC, audit logging, custom domains, white-labeling, and SSO.", gradient: "from-rose-500 to-pink-500" },
          ].map(({ icon: Icon, title, desc, gradient }, i) => (
            <AnimatedSection key={title} delay={i * 0.1}>
              <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
                <Card className="p-6 space-y-4 h-full hover:shadow-xl transition-shadow duration-300 border-transparent hover:border-primary/20">
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-md", gradient)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-lg">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </Card>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ========== STATS ========== */}
      <section className="relative bg-zinc-950 text-white py-20 overflow-hidden">
        <div className="absolute inset-0">
          <motion.div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-primary/10 blur-[100px]" animate={{ x: [0, 30, 0] }} transition={{ duration: 8, repeat: Infinity }} />
        </div>
        <div className="relative container mx-auto px-4">
          <div className="grid gap-8 grid-cols-2 lg:grid-cols-4 text-center">
            {[
              { value: String(stats.events), label: "Events Created" },
              { value: String(stats.registrations), label: "Registrations" },
              { value: String(stats.organizations), label: "Organizations" },
              { value: "—", label: "Average Rating" },
            ].map(({ value, label }, i) => (
              <AnimatedSection key={label} delay={i * 0.1}>
                <p className="text-4xl sm:text-5xl font-bold"><Counter target={value} /></p>
                <p className="text-sm text-zinc-400 mt-2">{label}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section className="container mx-auto px-4 py-24">
        <AnimatedSection className="text-center mb-14">
          <p className="text-sm font-medium text-primary mb-2 tracking-wider uppercase">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground mt-3">Start free, upgrade as you grow. No hidden fees.</p>
        </AnimatedSection>
        <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto pt-4">
          {[
            { name: "Free", price: "₹0", period: "/month", features: ["5 events/month", "100 participants", "Basic analytics", "Email support"], cta: "Get Started", href: "/signup" },
            { name: "Pro", price: "₹999", period: "/month", features: ["Unlimited events", "5,000 participants", "Advanced analytics", "Custom branding", "Priority support"], cta: "Start Free Trial", href: "/signup?plan=pro", popular: true },
            { name: "Enterprise", price: "Custom", period: "", features: ["Unlimited everything", "White-label", "SSO integration", "Dedicated support", "API access"], cta: "Contact Sales", href: "/contact" },
          ].map((plan, i) => (
            <AnimatedSection key={plan.name} delay={i * 0.1}>
              <motion.div whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300 }}>
                <Card className={cn("p-6 space-y-4 relative overflow-visible h-full", plan.popular && "border-primary shadow-xl shadow-primary/10 scale-[1.02]")}>
                  {plan.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 shadow-md">Most Popular</Badge>}
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-3xl font-bold mt-1">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.period}</span></p>
                  </div>
                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-green-500 shrink-0" />{f}</li>
                    ))}
                  </ul>
                  <Link href={plan.href} className={cn(buttonVariants({ variant: plan.popular ? "default" : "outline" }), "w-full rounded-xl")}>
                    {plan.cta}
                  </Link>
                </Card>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/pricing" className="text-sm text-primary hover:underline">Compare all features →</Link>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-linear-to-br from-primary via-primary/90 to-violet-600" />
        <motion.div className="absolute inset-0" animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }} transition={{ duration: 20, repeat: Infinity }}
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1), transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.05), transparent 50%)" }}
        />
        <AnimatedSection className="relative container mx-auto px-4 text-center space-y-6">
          <motion.div whileHover={{ scale: 1.05 }} className="inline-block">
            <Zap className="h-10 w-10 text-primary-foreground/80 mx-auto mb-4" />
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground">Ready to Create Your Next Event?</h2>
          <p className="text-primary-foreground/70 max-w-md mx-auto text-lg">
            Create, manage, and grow your events with the most complete platform available.
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-white text-primary hover:bg-white/90 text-base px-10 h-12 rounded-xl shadow-xl")}>
              Get Started for Free
            </Link>
          </motion.div>
          <p className="text-xs text-primary-foreground/50">No credit card required · Free forever for basic use</p>
        </AnimatedSection>
      </section>
    </div>
  )
}

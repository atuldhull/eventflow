import type { Metadata } from "next"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "About Us | EventFlow",
  description: "Learn about EventFlow — the professional event management platform built for organizations.",
}

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl space-y-12">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">About EventFlow</h1>
        <p className="text-muted-foreground">Professional event management, made simple.</p>
      </div>
      <div className="prose prose-zinc dark:prose-invert mx-auto">
        <p>EventFlow is a modern event management platform built for universities, companies, and organizations. We make it effortless to create, manage, and discover professional events.</p>
        <h2>Our Mission</h2>
        <p>To democratize professional event management by providing powerful, easy-to-use tools that help organizers focus on what matters most — creating amazing experiences for their attendees.</p>
        <h2>What We Offer</h2>
        <ul>
          <li>Intuitive event creation with a step-by-step builder</li>
          <li>Custom registration forms and smart workflows</li>
          <li>Integrated payments with Razorpay and Stripe</li>
          <li>QR code check-in for seamless event day operations</li>
          <li>Real-time analytics and performance dashboards</li>
          <li>Automated certificate generation and distribution</li>
        </ul>
        <h2>Built in India</h2>
        <p>EventFlow is proudly built in India, designed for the unique needs of Indian universities, colleges, and companies. We support INR payments, Indian phone numbers, and local event categories.</p>
      </div>
      <div className="text-center">
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>Join EventFlow Today</Link>
      </div>
    </div>
  )
}

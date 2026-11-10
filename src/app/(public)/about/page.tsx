import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Container, PageIntro } from "@/components/marketing/layout"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about EventFlow — the professional event management platform built for organizations.",
}

const OFFER = [
  "Intuitive event creation with a step-by-step builder",
  "Custom registration forms and smart workflows",
  "Integrated payments with Razorpay",
  "QR code check-in for seamless event day operations",
  "Real-time analytics and performance dashboards",
  "Automated certificate generation and distribution",
]

/** a settings-style row: the heading on the left, the words at a reading measure on the right */
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-rule py-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-12">
      <h2 className="text-lg leading-snug font-semibold">{title}</h2>
      <div className="max-w-[65ch] space-y-4 text-[15px] leading-7 text-muted-foreground">{children}</div>
    </section>
  )
}

export default function AboutPage() {
  return (
    <>
      <PageIntro title="About EventFlow" description="Professional event management, made simple." />

      <Container className="pt-12 pb-16 sm:pt-16 sm:pb-24">
        <p className="max-w-[60ch] pb-10 text-lg leading-8 text-foreground sm:text-xl sm:leading-9">
          EventFlow is a modern event management platform built for universities, companies, and organizations. We make it effortless to create,
          manage, and discover professional events.
        </p>

        <Row title="Our mission">
          <p>
            To democratize professional event management by providing powerful, easy-to-use tools that help organizers focus on what matters most —
            creating amazing experiences for their attendees.
          </p>
        </Row>

        <Row title="What we offer">
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {OFFER.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Check className="mt-1.5 size-4 shrink-0 text-brand" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Row>

        <Row title="Built in India">
          <p>
            EventFlow is proudly built in India, designed for the unique needs of Indian universities, colleges, and companies. We support INR payments,
            Indian phone numbers, and local event categories.
          </p>
        </Row>

        <div className="flex flex-col gap-4 border-t border-rule pt-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] text-muted-foreground">Ready to run your next event?</p>
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "px-5")}>
            Join EventFlow today
          </Link>
        </div>
      </Container>
    </>
  )
}

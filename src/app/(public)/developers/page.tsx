import type { Metadata } from "next"
import Link from "next/link"
import { Code, KeyRound, Webhook, ArrowRight } from "lucide-react"
import { Container } from "@/components/marketing/layout"
import { Reveal, WordReveal } from "@/components/marketing/fx"
import { Highlighter } from "@/components/marketing/kit"
import { CodeBlock } from "@/components/marketing/CodeBlock"
import { OnThisPage } from "@/components/marketing/OnThisPage"
import { ctaLemon } from "@/components/marketing/styles"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Developer Hub", description: "Integrate with EventFlow using our REST API and webhooks." }

const OVERVIEW = [
  { icon: Code, title: "REST API", desc: "Full CRUD for events, registrations, check-ins, and more", href: "#api" },
  { icon: KeyRound, title: "Authentication", desc: "Secure API keys with granular scopes and rate limiting", href: "#auth" },
  { icon: Webhook, title: "Webhooks", desc: "Real-time notifications for events as they happen", href: "#webhooks" },
]

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/events", desc: "List events", scope: "events:read" },
  { method: "POST", path: "/api/v1/events", desc: "Create an event", scope: "events:write" },
  { method: "GET", path: "/api/v1/events/:id", desc: "Get event details", scope: "events:read" },
  { method: "GET", path: "/api/v1/events/:id/registrations", desc: "List registrations", scope: "registrations:read" },
  { method: "POST", path: "/api/v1/events/:id/registrations", desc: "Create registration", scope: "registrations:write" },
  { method: "GET", path: "/api/v1/events/:id/check-ins", desc: "List check-ins", scope: "checkins:read" },
  { method: "POST", path: "/api/v1/events/:id/check-ins", desc: "Perform check-in", scope: "checkins:write" },
  { method: "GET", path: "/api/v1/events/:id/analytics", desc: "Event analytics", scope: "analytics:read" },
  { method: "GET", path: "/api/v1/tickets/:number/verify", desc: "Verify ticket", scope: "checkins:read" },
]

const WEBHOOK_EVENTS = ["event.created", "event.published", "event.cancelled", "registration.created", "registration.confirmed", "payment.completed", "payment.refunded", "checkin.completed", "certificate.generated"]

const ERRORS = [
  ["unauthorized", "401", "Invalid or missing API key"],
  ["forbidden", "403", "Insufficient scope"],
  ["not_found", "404", "Resource not found"],
  ["rate_limited", "429", "Rate limit exceeded"],
  ["internal_error", "500", "Server error"],
]

const TOC = [
  { id: "auth", label: "Authentication" },
  { id: "api", label: "API reference" },
  { id: "pagination", label: "Pagination" },
  { id: "webhooks", label: "Webhooks" },
  { id: "errors", label: "Error handling" },
]

function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-5 border-t border-rule pt-12">
      <h2 id={`${id}-title`} className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.035em] sm:text-[38px]">{title}</h2>
      {children}
    </section>
  )
}

export default function DeveloperHubPage() {
  return (
    <>
      {/* ========== HERO: an always-dark field, the first request beside the headline ========== */}
      <header className="relative overflow-hidden bg-charcoal text-white dark:bg-frame">
        <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 size-[560px] rounded-full bg-lavender/25 blur-[140px]" />
        <Container className="relative grid gap-12 pt-14 pb-12 sm:pt-20 sm:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="flex flex-wrap items-center gap-3 text-sm font-semibold text-lemon">
              <span className="flex items-center gap-2">
                <span className="h-[2px] w-6 rounded-full bg-lavender" aria-hidden />
                Developer hub
              </span>
              <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[12px] font-medium text-white/70">
                Current version: <span className="font-mono text-white">API v1</span>
              </span>
            </p>
            <h1 className="font-display mt-5 max-w-[14ch] text-[40px] leading-[1.02] font-extrabold tracking-[-0.045em] text-balance sm:text-[60px] lg:text-[68px]">
              <WordReveal text="Build on" /> <Highlighter delay={0.35}>EventFlow</Highlighter>
            </h1>
            <Reveal delay={0.35} y={16}>
              <p className="mt-6 max-w-[48ch] text-[17px] leading-relaxed text-white/65">Integrate EventFlow with your systems using our REST API and webhooks.</p>
            </Reveal>
          </div>
          <Reveal delay={0.2} className="min-w-0">
            <CodeBlock label="Your first request" className="border-white/15">{`curl -H "Authorization: Bearer evf_live_YOUR_KEY" \\
  https://your-domain.com/api/v1/events`}</CodeBlock>
          </Reveal>
        </Container>

        {/* the three ways in, as a strip of coloured tiles */}
        <Container className="relative pb-14 sm:pb-20">
          <ul className="grid gap-3 sm:grid-cols-3">
            {OVERVIEW.map(({ icon: Icon, title, desc, href }, i) => (
              <li key={title}>
                <a
                  href={href}
                  className={cn(
                    "group flex h-full flex-col justify-between gap-8 rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1",
                    i === 0 && "bg-lemon text-lemon-ink",
                    i === 1 && "bg-lavender text-charcoal",
                    i === 2 && "border border-white/15 text-white hover:border-lavender",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <Icon className="size-6" strokeWidth={1.75} aria-hidden />
                    <ArrowRight className="size-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                  </span>
                  <span>
                    <span className="font-display block text-[22px] font-bold tracking-[-0.02em]">{title}</span>
                    <span className={cn("mt-1 block text-[14px] leading-relaxed", i === 2 ? "text-white/60" : "opacity-80")}>{desc}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </header>

      <Container className="grid gap-10 py-16 sm:py-20 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <div className="hidden lg:block">
          <OnThisPage items={TOC} className="sticky top-24" />
        </div>

        <div className="min-w-0 max-w-[820px] space-y-12 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
          <DocSection id="auth" title="Authentication">
            <p className="max-w-[62ch] text-[16px] leading-7 text-muted-foreground">All API requests require an API key sent via the Authorization header.</p>
            <CodeBlock label="Request">{`curl -H "Authorization: Bearer evf_live_YOUR_KEY" \\
  https://your-domain.com/api/v1/events`}</CodeBlock>
            <p className="text-sm text-muted-foreground">API keys are available on Pro and Enterprise plans. Generate keys in your organization settings.</p>
          </DocSection>

          <DocSection id="api" title="API reference">
            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="hidden grid-cols-[72px_minmax(0,1fr)_minmax(0,180px)_160px] gap-4 border-b border-rule bg-raised px-5 py-3 text-xs font-medium text-muted-foreground md:grid">
                <span>Method</span>
                <span>Endpoint</span>
                <span>Description</span>
                <span>Scope</span>
              </div>
              <ul className="divide-y divide-rule">
                {ENDPOINTS.map((endpoint) => (
                  <li
                    key={endpoint.path + endpoint.method}
                    className="grid grid-cols-[60px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-raised/60 md:grid-cols-[72px_minmax(0,1fr)_minmax(0,180px)_160px] md:gap-4"
                  >
                    <span
                      className={cn(
                        "inline-flex w-fit items-center justify-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wide",
                        endpoint.method === "GET" ? "bg-lavender/20 text-brand" : "bg-lemon text-lemon-ink",
                      )}
                    >
                      {endpoint.method}
                    </span>
                    <code className="font-mono text-[13.5px] font-medium break-all">{endpoint.path}</code>
                    <span className="col-start-2 text-[14px] text-muted-foreground md:col-start-auto">{endpoint.desc}</span>
                    <span className="col-start-2 md:col-start-auto">
                      <code className="inline-flex rounded-md border border-rule bg-raised px-1.5 py-0.5 font-mono text-[11.5px] text-muted-foreground">{endpoint.scope}</code>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </DocSection>

          <DocSection id="pagination" title="Pagination">
            <p className="max-w-[62ch] text-[16px] leading-7 text-muted-foreground">List endpoints return paginated results.</p>
            <CodeBlock label="Response">{`{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasMore": true
  }
}`}</CodeBlock>
          </DocSection>

          <DocSection id="webhooks" title="Webhooks">
            <p className="max-w-[62ch] text-[16px] leading-7 text-muted-foreground">Receive real-time notifications when events happen in EventFlow.</p>
            <ul className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((evt) => (
                <li key={evt} className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 font-mono text-[13px]">
                  <span className="size-1.5 rounded-full bg-lavender" aria-hidden />
                  {evt}
                </li>
              ))}
            </ul>
            <h3 className="font-display pt-4 text-[20px] font-bold tracking-[-0.02em]">Signature verification</h3>
            <CodeBlock label="Node.js">{`const crypto = require('crypto');
const signature = req.headers['x-eventflow-signature'];
const timestamp = req.headers['x-eventflow-timestamp'];
const expected = crypto
  .createHmac('sha256', webhookSecret)
  .update(timestamp + '.' + JSON.stringify(req.body))
  .digest('hex');
const isValid = signature === expected;`}</CodeBlock>
          </DocSection>

          <DocSection id="errors" title="Error handling">
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full min-w-[440px] text-sm">
                <thead>
                  <tr className="border-b border-rule bg-raised text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">Code</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {ERRORS.map(([code, status, desc]) => (
                    <tr key={code}>
                      <td className="px-4 py-3 font-mono text-[13px]">{code}</td>
                      <td className="px-4 py-3"><span className="font-display text-[17px] font-bold tabular-nums">{status}</span></td>
                      <td className="px-4 py-3 text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>

          <div className="relative overflow-hidden rounded-[28px] bg-charcoal p-8 text-white sm:p-10 dark:border dark:border-white/10">
            <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 size-72 rounded-full bg-lavender/30 blur-[90px]" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.035em] sm:text-[34px]">Ready to build on EventFlow?</p>
              <Link href="/signup" className={cn(ctaLemon, "shrink-0")}>
                Get started <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </>
  )
}

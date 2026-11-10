import type { Metadata } from "next"
import Link from "next/link"
import { Code, KeyRound, Webhook, ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Container, PageIntro } from "@/components/marketing/layout"
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

function CodeBlock({ label, children }: { label: string; children: string }) {
  return (
    <figure className="overflow-hidden rounded-lg border bg-raised">
      <figcaption className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{label}</figcaption>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-6 text-foreground">
        <code>{children}</code>
      </pre>
    </figure>
  )
}

function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-4 border-t border-rule pt-10">
      <h2 id={`${id}-title`} className="text-[22px] leading-tight font-semibold tracking-[-0.015em]">{title}</h2>
      {children}
    </section>
  )
}

export default function DeveloperHubPage() {
  return (
    <>
      <PageIntro
        title="Developer hub"
        description="Integrate EventFlow with your systems using our REST API and webhooks."
        meta={<>Current version: <span className="font-mono text-foreground">API v1</span></>}
      >
        <ul className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
          {OVERVIEW.map(({ icon: Icon, title, desc, href }) => (
            <li key={title} className="bg-background">
              <a href={href} className="group flex h-full flex-col gap-3 p-5 transition-colors hover:bg-raised focus-visible:-outline-offset-2">
                <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-foreground" strokeWidth={1.5} aria-hidden />
                <span>
                  <span className="block text-[15px] font-semibold">{title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{desc}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </PageIntro>

      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-[13px] font-medium">On this page</p>
            <ol className="mt-3 border-l border-border">
              {TOC.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-[13px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
                    {t.label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="min-w-0 max-w-[820px] space-y-12 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
          <DocSection id="auth" title="Authentication">
            <p className="text-[15px] leading-7 text-muted-foreground">All API requests require an API key sent via the Authorization header.</p>
            <CodeBlock label="Request">{`curl -H "Authorization: Bearer evf_live_YOUR_KEY" \\
  https://your-domain.com/api/v1/events`}</CodeBlock>
            <p className="text-sm text-muted-foreground">API keys are available on Pro and Enterprise plans. Generate keys in your organization settings.</p>
          </DocSection>

          <DocSection id="api" title="API reference">
            <div className="overflow-hidden rounded-lg border">
              <div className="hidden grid-cols-[64px_minmax(0,1fr)_minmax(0,180px)_160px] gap-4 border-b border-rule bg-raised px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
                <span>Method</span>
                <span>Endpoint</span>
                <span>Description</span>
                <span>Scope</span>
              </div>
              <ul className="divide-y divide-rule">
                {ENDPOINTS.map((endpoint) => (
                  <li
                    key={endpoint.path + endpoint.method}
                    className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[64px_minmax(0,1fr)_minmax(0,180px)_160px] md:gap-4"
                  >
                    <span className={cn("font-mono text-xs font-semibold", endpoint.method === "GET" ? "text-muted-foreground" : "text-foreground")}>
                      {endpoint.method}
                    </span>
                    <code className="font-mono text-[13px] break-all">{endpoint.path}</code>
                    <span className="col-start-2 text-[13px] text-muted-foreground md:col-start-auto">{endpoint.desc}</span>
                    <span className="col-start-2 md:col-start-auto">
                      <code className="inline-flex rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11.5px] text-muted-foreground">{endpoint.scope}</code>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </DocSection>

          <DocSection id="pagination" title="Pagination">
            <p className="text-[15px] leading-7 text-muted-foreground">List endpoints return paginated results.</p>
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
            <p className="text-[15px] leading-7 text-muted-foreground">Receive real-time notifications when events happen in EventFlow.</p>
            <ul className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
              {WEBHOOK_EVENTS.map((evt) => (
                <li key={evt} className="bg-background px-4 py-2.5 font-mono text-[13px]">{evt}</li>
              ))}
            </ul>
            <h3 className="pt-4 text-[15px] font-semibold">Signature verification</h3>
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
            <div className="overflow-x-auto rounded-lg border">
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
                      <td className="px-4 py-3 tabular-nums">{status}</td>
                      <td className="px-4 py-3 text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>

          <div className="flex flex-col gap-4 border-t border-rule pt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] text-muted-foreground">Ready to build on EventFlow?</p>
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "px-5")}>
              Get started <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </Container>
    </>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { Code, Key, Webhook, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Developer Hub | EventFlow", description: "Integrate with EventFlow using our REST API and webhooks." }

export default function DeveloperHubPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl space-y-12">
      <div className="text-center space-y-3">
        <Badge variant="secondary">API v1</Badge>
        <h1 className="text-4xl font-bold">Developer Hub</h1>
        <p className="text-muted-foreground max-w-md mx-auto">Integrate EventFlow with your systems using our REST API and webhooks.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { icon: Code, title: "REST API", desc: "Full CRUD for events, registrations, check-ins, and more", href: "#api" },
          { icon: Key, title: "Authentication", desc: "Secure API keys with granular scopes and rate limiting", href: "#auth" },
          { icon: Webhook, title: "Webhooks", desc: "Real-time notifications for events as they happen", href: "#webhooks" },
        ].map(({ icon: Icon, title, desc, href }) => (
          <Card key={title} className="p-6 text-center hover:shadow-md transition-shadow">
            <Icon className="h-8 w-8 mx-auto text-primary mb-3" />
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{desc}</p>
          </Card>
        ))}
      </div>

      {/* Authentication */}
      <section id="auth" className="space-y-4">
        <h2 className="text-2xl font-bold">Authentication</h2>
        <p className="text-muted-foreground">All API requests require an API key sent via the Authorization header.</p>
        <Card className="p-4 bg-zinc-950 text-zinc-100 font-mono text-sm overflow-x-auto">
          <pre>{`curl -H "Authorization: Bearer evf_live_YOUR_KEY" \\
  https://your-domain.com/api/v1/events`}</pre>
        </Card>
        <p className="text-sm text-muted-foreground">API keys are available on Pro and Enterprise plans. Generate keys in your organization settings.</p>
      </section>

      {/* API Reference */}
      <section id="api" className="space-y-4">
        <h2 className="text-2xl font-bold">API Reference</h2>
        <div className="space-y-3">
          {[
            { method: "GET", path: "/api/v1/events", desc: "List events", scope: "events:read" },
            { method: "POST", path: "/api/v1/events", desc: "Create an event", scope: "events:write" },
            { method: "GET", path: "/api/v1/events/:id", desc: "Get event details", scope: "events:read" },
            { method: "GET", path: "/api/v1/events/:id/registrations", desc: "List registrations", scope: "registrations:read" },
            { method: "POST", path: "/api/v1/events/:id/registrations", desc: "Create registration", scope: "registrations:write" },
            { method: "GET", path: "/api/v1/events/:id/check-ins", desc: "List check-ins", scope: "checkins:read" },
            { method: "POST", path: "/api/v1/events/:id/check-ins", desc: "Perform check-in", scope: "checkins:write" },
            { method: "GET", path: "/api/v1/events/:id/analytics", desc: "Event analytics", scope: "analytics:read" },
            { method: "GET", path: "/api/v1/tickets/:number/verify", desc: "Verify ticket", scope: "checkins:read" },
          ].map((endpoint) => (
            <div key={endpoint.path + endpoint.method} className="flex items-center gap-3 rounded-lg border p-3">
              <Badge variant={endpoint.method === "GET" ? "secondary" : "default"} className="font-mono text-xs w-14 justify-center">{endpoint.method}</Badge>
              <code className="text-sm font-mono flex-1">{endpoint.path}</code>
              <span className="text-xs text-muted-foreground hidden sm:block">{endpoint.desc}</span>
              <Badge variant="outline" className="text-[9px]">{endpoint.scope}</Badge>
            </div>
          ))}
        </div>
      </section>

      {/* Pagination */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Pagination</h2>
        <p className="text-muted-foreground">List endpoints return paginated results.</p>
        <Card className="p-4 bg-zinc-950 text-zinc-100 font-mono text-sm overflow-x-auto">
          <pre>{`{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasMore": true
  }
}`}</pre>
        </Card>
      </section>

      {/* Webhooks */}
      <section id="webhooks" className="space-y-4">
        <h2 className="text-2xl font-bold">Webhooks</h2>
        <p className="text-muted-foreground">Receive real-time notifications when events happen in EventFlow.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {["event.created", "event.published", "event.cancelled", "registration.created", "registration.confirmed", "payment.completed", "payment.refunded", "checkin.completed", "certificate.generated"].map((evt) => (
            <div key={evt} className="flex items-center gap-2 rounded border px-3 py-2 text-sm font-mono">{evt}</div>
          ))}
        </div>
        <h3 className="font-semibold mt-4">Signature Verification</h3>
        <Card className="p-4 bg-zinc-950 text-zinc-100 font-mono text-sm overflow-x-auto">
          <pre>{`const crypto = require('crypto');
const signature = req.headers['x-eventflow-signature'];
const timestamp = req.headers['x-eventflow-timestamp'];
const expected = crypto
  .createHmac('sha256', webhookSecret)
  .update(timestamp + '.' + JSON.stringify(req.body))
  .digest('hex');
const isValid = signature === expected;`}</pre>
        </Card>
      </section>

      {/* Errors */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Error Handling</h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted"><th className="text-left px-4 py-2">Code</th><th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Description</th></tr></thead>
            <tbody>
              {[
                ["unauthorized", "401", "Invalid or missing API key"],
                ["forbidden", "403", "Insufficient scope"],
                ["not_found", "404", "Resource not found"],
                ["rate_limited", "429", "Rate limit exceeded"],
                ["internal_error", "500", "Server error"],
              ].map(([code, status, desc]) => (
                <tr key={code} className="border-t"><td className="px-4 py-2 font-mono">{code}</td><td className="px-4 py-2">{status}</td><td className="px-4 py-2 text-muted-foreground">{desc}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-center">
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
          Get Started <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

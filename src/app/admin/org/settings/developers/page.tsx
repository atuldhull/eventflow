"use client"

import { useState, useEffect } from "react"
import { Key, Webhook, Plus, Copy, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"

const SCOPE_GROUPS = [
  { group: "Events", scopes: [{ value: "events:read", label: "Read" }, { value: "events:write", label: "Write" }] },
  { group: "Registrations", scopes: [{ value: "registrations:read", label: "Read" }, { value: "registrations:write", label: "Write" }] },
  { group: "Check-ins", scopes: [{ value: "checkins:read", label: "Read" }, { value: "checkins:write", label: "Write" }] },
  { group: "Payments", scopes: [{ value: "payments:read", label: "Read" }] },
  { group: "Analytics", scopes: [{ value: "analytics:read", label: "Read" }] },
  { group: "Certificates", scopes: [{ value: "certificates:read", label: "Read" }, { value: "certificates:write", label: "Write" }] },
  { group: "Participants", scopes: [{ value: "participants:read", label: "Read" }] },
]

const WEBHOOK_EVENTS = [
  { group: "Events", events: ["event.created", "event.updated", "event.published", "event.cancelled", "event.completed"] },
  { group: "Registrations", events: ["registration.created", "registration.confirmed", "registration.cancelled"] },
  { group: "Payments", events: ["payment.completed", "payment.refunded"] },
  { group: "Check-in", events: ["checkin.completed"] },
  { group: "Certificates", events: ["certificate.generated"] },
]

interface ApiKeyData { id: string; name: string; prefix: string; scopes: string[]; isActive: boolean; lastUsedAt: string | null; createdAt: string }
interface WebhookData { id: string; url: string; events: string[]; isActive: boolean; failureCount: number; lastDeliveredAt: string | null; createdAt: string }

/** A mono value with a copy button; the toast says "Copied!" as before. */
function SecretValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-stretch overflow-hidden rounded-md border bg-raised">
      <code className="min-w-0 flex-1 px-3 py-2.5 font-mono text-[13px] break-all select-all">{value}</code>
      <Button
        type="button"
        variant="ghost"
        className="h-auto shrink-0 rounded-none border-l"
        onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied!"); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
      </Button>
    </div>
  )
}

function CopyIcon({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      className="text-muted-foreground"
      onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied!"); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}


export default function DeveloperSettingsPage() {
  const { currentOrganizationId } = useRBAC()
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([])
  const [webhooks, setWebhooks] = useState<WebhookData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Create API Key state
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [keyName, setKeyName] = useState("")
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)

  // Create Webhook state
  const [createWebhookOpen, setCreateWebhookOpen] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetchData() {
      try {
        const [keysRes, webhooksRes] = await Promise.all([
          fetch(`/api/admin/org/${currentOrganizationId}/api-keys`),
          fetch(`/api/admin/org/${currentOrganizationId}/webhooks`),
        ])
        const keysData = await keysRes.json()
        const webhooksData = await webhooksRes.json()
        if (keysData.success) setApiKeys(keysData.data)
        if (webhooksData.success) setWebhooks(webhooksData.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetchData()
  }, [currentOrganizationId])

  const handleCreateKey = async () => {
    if (!keyName || selectedScopes.length === 0 || !currentOrganizationId) { toast.error("Name and scopes required"); return }
    setIsCreating(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/api-keys`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName, scopes: selectedScopes }),
      })
      const data = await res.json()
      if (data.success) {
        setNewKey(data.data.key)
        toast.success("API key created!")
      } else toast.error(data.message)
    } catch { toast.error("Failed to create key") }
    finally { setIsCreating(false) }
  }

  const handleCreateWebhook = async () => {
    if (!webhookUrl || selectedEvents.length === 0 || !currentOrganizationId) { toast.error("URL and events required"); return }
    setIsCreatingWebhook(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/webhooks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, events: selectedEvents }),
      })
      const data = await res.json()
      if (data.success) {
        setNewSecret(data.data.secret)
        toast.success("Webhook created!")
      } else toast.error(data.message)
    } catch { toast.error("Failed to create webhook") }
    finally { setIsCreatingWebhook(false) }
  }

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope])
  }

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event])
  }

  const listSkeleton = (
    <div className="overflow-hidden rounded-lg border" aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className={cn("space-y-2 px-4 py-3.5", i > 0 && "border-t border-rule")}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developers"
        description="Manage API keys and webhooks"
        breadcrumbs={[{ label: "Settings", href: "/admin/org/settings" }, { label: "Developers" }]}
      />

      <Tabs defaultValue="api-keys" className="gap-5">
        <TabsList variant="line">
          <TabsTrigger value="api-keys">API keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        {/* API keys */}
        <TabsContent value="api-keys" className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-muted-foreground">Keys let your own apps call the EventFlow API for this organization.</p>
            <Dialog open={createKeyOpen} onOpenChange={(o) => { setCreateKeyOpen(o); if (!o) { setNewKey(null); setKeyName(""); setSelectedScopes([]) } }}>
              <DialogTrigger render={<Button className="shrink-0 max-sm:w-full" />}><Plus /> Create API key</DialogTrigger>
              <DialogContent>
                {newKey ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>API key created</DialogTitle>
                      <DialogDescription>Copy this key now. You won&apos;t see it again.</DialogDescription>
                    </DialogHeader>
                    <SecretValue value={newKey} label="Copy key" />
                    <DialogFooter><Button onClick={() => { setCreateKeyOpen(false); setNewKey(null) }}>Done</Button></DialogFooter>
                  </>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleCreateKey() }} className="grid gap-4">
                    <DialogHeader><DialogTitle>Create API key</DialogTitle></DialogHeader>
                    <div className="grid gap-1.5">
                      <Label htmlFor="key-name">Key name</Label>
                      <Input id="key-name" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g., Production API" />
                    </div>
                    <fieldset className="grid gap-1.5">
                      <legend className="mb-1.5 text-sm font-medium">Scopes</legend>
                      <div className="divide-y divide-rule rounded-lg border">
                        {SCOPE_GROUPS.map((group) => (
                          <div key={group.group} className="flex min-h-11 items-center gap-3 px-3 py-1.5">
                            <span className="flex-1 text-sm">{group.group}</span>
                            {group.scopes.map((s) => (
                              <label key={s.value} className="flex min-h-9 w-16 cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                                <Checkbox checked={selectedScopes.includes(s.value)} onCheckedChange={() => toggleScope(s.value)} aria-label={`${group.group} ${s.label.toLowerCase()}`} />
                                {s.label}
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    </fieldset>
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                      <Button type="submit" disabled={isCreating}>{isCreating && <Loader2 className="animate-spin" />}Create key</Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? listSkeleton : apiKeys.length === 0 ? (
            <EmptyState icon={Key} title="No API keys" description="Create an API key to start integrating." />
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-lg border">
              {apiKeys.map((key) => (
                <li key={key.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{key.name}</p>
                      <Pill tone={key.isActive ? "positive" : "neutral"}>{key.isActive ? "Active" : "Revoked"}</Pill>
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="font-mono text-[13px] text-muted-foreground">{key.prefix}…</code>
                      <CopyIcon value={key.prefix} label={`Copy ${key.name} key prefix`} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.slice(0, 3).map((s) => <span key={s} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{s}</span>)}
                      {key.scopes.length > 3 && <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">+{key.scopes.length - 3}</span>}
                    </div>
                  </div>
                  <p className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                    {key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Webhooks */}
        <TabsContent value="webhooks" className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-muted-foreground">Receive real-time event notifications at your own endpoints.</p>
            <Dialog open={createWebhookOpen} onOpenChange={(o) => { setCreateWebhookOpen(o); if (!o) { setNewSecret(null); setWebhookUrl(""); setSelectedEvents([]) } }}>
              <DialogTrigger render={<Button className="shrink-0 max-sm:w-full" />}><Plus /> Add endpoint</DialogTrigger>
              <DialogContent>
                {newSecret ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Webhook created</DialogTitle>
                      <DialogDescription>Copy the signing secret now. You won&apos;t see it again.</DialogDescription>
                    </DialogHeader>
                    <SecretValue value={newSecret} label="Copy secret" />
                    <DialogFooter><Button onClick={() => { setCreateWebhookOpen(false); setNewSecret(null) }}>Done</Button></DialogFooter>
                  </>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleCreateWebhook() }} className="grid gap-4">
                    <DialogHeader><DialogTitle>Add webhook endpoint</DialogTitle></DialogHeader>
                    <div className="grid gap-1.5">
                      <Label htmlFor="webhook-url">Endpoint URL</Label>
                      <Input id="webhook-url" inputMode="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-app.com/webhooks" className="font-mono text-[13px]" />
                    </div>
                    <fieldset className="grid gap-3">
                      <legend className="mb-1.5 text-sm font-medium">Events</legend>
                      {WEBHOOK_EVENTS.map((group) => (
                        <div key={group.group} className="space-y-1">
                          <p className="text-[13px] text-muted-foreground">{group.group}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {group.events.map((evt) => (
                              <label key={evt} className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px]">
                                <Checkbox checked={selectedEvents.includes(evt)} onCheckedChange={() => toggleEvent(evt)} aria-label={evt} />
                                {evt.split(".")[1]}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </fieldset>
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                      <Button type="submit" disabled={isCreatingWebhook}>{isCreatingWebhook && <Loader2 className="animate-spin" />}Create</Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? listSkeleton : webhooks.length === 0 ? (
            <EmptyState icon={Webhook} title="No webhook endpoints" description="Add an endpoint to receive real-time event notifications." />
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-lg border">
              {webhooks.map((wh) => (
                <li key={wh.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex min-w-0 items-center gap-1">
                      <code className="min-w-0 truncate font-mono text-[13px]">{wh.url}</code>
                      <CopyIcon value={wh.url} label="Copy endpoint URL" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={wh.isActive ? "positive" : "neutral"}>{wh.isActive ? "Active" : "Disabled"}</Pill>
                      {wh.failureCount > 0 && <Pill tone="negative">{wh.failureCount} failures</Pill>}
                      <span className="text-[13px] text-muted-foreground">{wh.events.length} events subscribed</span>
                    </div>
                  </div>
                  <p className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                    {wh.lastDeliveredAt ? `Last delivery ${new Date(wh.lastDeliveredAt).toLocaleDateString()}` : "No deliveries"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

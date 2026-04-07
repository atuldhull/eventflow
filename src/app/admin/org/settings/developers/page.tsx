"use client"

import { useState, useEffect } from "react"
import { Key, Webhook, Plus, Copy, Trash2, Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { useRBAC } from "@/hooks/useRBAC"

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Settings"
        description="Manage API keys and webhooks"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organization", href: "/admin/org" }, { label: "Settings", href: "/admin/org/settings" }, { label: "Developers" }]}
      />

      <Tabs defaultValue="api-keys">
        <TabsList>
          <TabsTrigger value="api-keys" className="gap-1"><Key className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1"><Webhook className="h-3.5 w-3.5" /> Webhooks</TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={createKeyOpen} onOpenChange={(o) => { setCreateKeyOpen(o); if (!o) { setNewKey(null); setKeyName(""); setSelectedScopes([]) } }}>
              <DialogTrigger render={<Button className="gap-2" />}><Plus className="h-4 w-4" /> Create API Key</DialogTrigger>
              <DialogContent>
                {newKey ? (
                  <>
                    <DialogHeader><DialogTitle>API Key Created</DialogTitle><DialogDescription>Copy this key now. You won&apos;t see it again.</DialogDescription></DialogHeader>
                    <div className="space-y-3 py-4">
                      <div className="rounded-lg bg-muted p-3 font-mono text-xs break-all">{newKey}</div>
                      <Button variant="outline" className="w-full gap-2" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied!") }}>
                        <Copy className="h-4 w-4" /> Copy Key
                      </Button>
                    </div>
                    <DialogFooter><Button onClick={() => { setCreateKeyOpen(false); setNewKey(null) }}>Done</Button></DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader><DialogTitle>Create API Key</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label>Key Name</Label><Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g., Production API" /></div>
                      <div className="space-y-2">
                        <Label>Scopes</Label>
                        {SCOPE_GROUPS.map((group) => (
                          <div key={group.group} className="flex items-center gap-3 py-1">
                            <span className="text-sm w-28">{group.group}</span>
                            {group.scopes.map((s) => (
                              <label key={s.value} className="flex items-center gap-1.5 text-xs">
                                <Checkbox checked={selectedScopes.includes(s.value)} onCheckedChange={() => toggleScope(s.value)} />{s.label}
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                      <Button onClick={handleCreateKey} disabled={isCreating}>{isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Key</Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {apiKeys.length === 0 ? (
            <Card className="p-8 text-center"><Key className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No API keys</p><p className="text-sm text-muted-foreground">Create an API key to start integrating.</p></Card>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <Card key={key.id} className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{key.name}</p>
                      <Badge variant={key.isActive ? "default" : "secondary"}>{key.isActive ? "Active" : "Revoked"}</Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{key.prefix}...</p>
                    <div className="flex gap-1">{key.scopes.slice(0, 3).map((s) => <Badge key={s} variant="outline" className="text-[9px]">{s}</Badge>)}{key.scopes.length > 3 && <Badge variant="outline" className="text-[9px]">+{key.scopes.length - 3}</Badge>}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">{key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}</p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={createWebhookOpen} onOpenChange={(o) => { setCreateWebhookOpen(o); if (!o) { setNewSecret(null); setWebhookUrl(""); setSelectedEvents([]) } }}>
              <DialogTrigger render={<Button className="gap-2" />}><Plus className="h-4 w-4" /> Add Endpoint</DialogTrigger>
              <DialogContent>
                {newSecret ? (
                  <>
                    <DialogHeader><DialogTitle>Webhook Created</DialogTitle><DialogDescription>Copy the signing secret now. You won&apos;t see it again.</DialogDescription></DialogHeader>
                    <div className="space-y-3 py-4">
                      <div className="rounded-lg bg-muted p-3 font-mono text-xs break-all">{newSecret}</div>
                      <Button variant="outline" className="w-full gap-2" onClick={() => { navigator.clipboard.writeText(newSecret); toast.success("Copied!") }}>
                        <Copy className="h-4 w-4" /> Copy Secret
                      </Button>
                    </div>
                    <DialogFooter><Button onClick={() => { setCreateWebhookOpen(false); setNewSecret(null) }}>Done</Button></DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader><DialogTitle>Add Webhook Endpoint</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2"><Label>Endpoint URL</Label><Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-app.com/webhooks" /></div>
                      <div className="space-y-2">
                        <Label>Events</Label>
                        {WEBHOOK_EVENTS.map((group) => (
                          <div key={group.group} className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">{group.group}</p>
                            <div className="flex flex-wrap gap-2">
                              {group.events.map((evt) => (
                                <label key={evt} className="flex items-center gap-1.5 text-xs">
                                  <Checkbox checked={selectedEvents.includes(evt)} onCheckedChange={() => toggleEvent(evt)} />
                                  {evt.split(".")[1]}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                      <Button onClick={handleCreateWebhook} disabled={isCreatingWebhook}>{isCreatingWebhook && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create</Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {webhooks.length === 0 ? (
            <Card className="p-8 text-center"><Webhook className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" /><p className="font-medium">No webhook endpoints</p><p className="text-sm text-muted-foreground">Add an endpoint to receive real-time event notifications.</p></Card>
          ) : (
            <div className="space-y-2">
              {webhooks.map((wh) => (
                <Card key={wh.id} className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono truncate max-w-xs">{wh.url}</p>
                      <Badge variant={wh.isActive ? "default" : "secondary"}>{wh.isActive ? "Active" : "Disabled"}</Badge>
                      {wh.failureCount > 0 && <Badge variant="destructive" className="text-[9px]">{wh.failureCount} failures</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{wh.events.length} events subscribed</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{wh.lastDeliveredAt ? `Last delivery ${new Date(wh.lastDeliveredAt).toLocaleDateString()}` : "No deliveries"}</p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

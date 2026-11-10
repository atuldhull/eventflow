"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Send } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Section, fmtDateTime } from "@/app/admin/enterprise/_components/admin-ui"
import { PLATFORM_FEATURES, UNAVAILABLE_SETTINGS, type PlatformSettings, type PlatformFeatureKey } from "@/lib/platform-settings"

interface Transport { provider: string; host: string | null; envFrom: string | null }

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** `unavailable`: a switch the platform can't honour yet, shown off and disabled with the reason */
function ToggleRow({ id, title, description, checked, onCheckedChange, danger, unavailable }: { id: string; title: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void; danger?: boolean; unavailable?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} id={`${id}-label`} className={danger ? "text-destructive" : undefined}>{title}</Label>
        <p id={`${id}-hint`} className="mt-0.5 text-[13px] text-muted-foreground">{description}{unavailable && <span className="mt-1 block text-warning">{unavailable}</span>}</p>
      </div>
      <Switch id={id} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} checked={unavailable ? false : checked} disabled={!!unavailable} onCheckedChange={onCheckedChange} className="mt-0.5" />
    </div>
  )
}

const swatch =
  "size-9 cursor-pointer rounded-md border border-input bg-background p-1 pointer-coarse:size-11 [&::-moz-color-swatch]:rounded-[3px] [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[3px] [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"

/** Number inputs hold text while typing; this turns them back into integers (NaN stays invalid server-side). */
const toInt = (v: string) => (v.trim() === "" ? NaN : Math.trunc(Number(v)))

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [saved, setSaved] = useState<string>("")
  const [transport, setTransport] = useState<Transport | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [testTo, setTestTo] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/super-admin/settings")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) {
          setSettings(json.data.settings)
          setSaved(JSON.stringify(json.data.settings))
          setTransport(json.data.emailTransport)
          setUpdatedAt(json.data.updatedAt)
        } else toast.error(json.message || "Failed to load settings")
      })
      .catch(() => { if (!cancelled) toast.error("Failed to load settings") })
    return () => { cancelled = true }
  }, [])

  const update = <S extends keyof PlatformSettings, K extends keyof PlatformSettings[S]>(section: S, key: K, value: PlatformSettings[S][K]) =>
    setSettings((s) => (s ? { ...s, [section]: { ...s[section], [key]: value } } : s))

  const dirty = !!settings && JSON.stringify(settings) !== saved

  const handleSave = async () => {
    if (!settings) return
    setIsSaving(true)
    try {
      const res = await fetch("/api/super-admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (json.success) {
        setSettings(json.data.settings)
        setSaved(JSON.stringify(json.data.settings))
        setUpdatedAt(json.data.updatedAt)
        toast.success(json.message || "Settings saved")
      } else toast.error(json.message || "Failed to save")
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const sendTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/super-admin/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testTo.trim() ? { to: testTo.trim() } : {}),
      })
      const json = await res.json().catch(() => null)
      const message = json?.message || (res.ok ? "Test email sent" : "The test email failed")
      setTestResult({ ok: !!json?.success, message })
      if (json?.success) toast.success(message)
      else toast.error(message)
    } catch {
      setTestResult({ ok: false, message: "Couldn't reach the server" })
      toast.error("Couldn't reach the server")
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Settings"
        description={updatedAt ? `Global settings for the whole platform · last saved ${fmtDateTime(updatedAt)}` : "Global settings for the whole platform"}
        actions={
          <Button onClick={handleSave} disabled={isSaving || !dirty}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save settings
          </Button>
        }
      />

      {!settings ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="general">
          <TabsList variant="line">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0 space-y-8">
            <Section title="Platform" description="The name and address people see.">
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="p-name" label="Platform name">{(id) => <Input id={id} value={settings.general.platformName} maxLength={80} onChange={(e) => update("general", "platformName", e.target.value)} />}</Field>
                  <Field id="p-email" label="Contact email">{(id) => <Input id={id} type="email" value={settings.general.contactEmail} onChange={(e) => update("general", "contactEmail", e.target.value)} />}</Field>
                </div>
                <Field id="p-description" label="Platform description">
                  {(id) => <Textarea id={id} rows={3} maxLength={500} value={settings.general.description} onChange={(e) => update("general", "description", e.target.value)} />}
                </Field>
              </div>
            </Section>
            <Section title="Colours" description="Default colours for tenants without their own.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="p-primary" label="Primary colour">
                  {(id) => (
                    <div className="flex gap-2">
                      <input id={id} type="color" value={settings.general.primaryColor} onChange={(e) => update("general", "primaryColor", e.target.value)} className={swatch} />
                      <span className="self-center font-mono text-[13px] text-muted-foreground">{settings.general.primaryColor}</span>
                    </div>
                  )}
                </Field>
                <Field id="p-secondary" label="Secondary colour">
                  {(id) => (
                    <div className="flex gap-2">
                      <input id={id} type="color" value={settings.general.secondaryColor} onChange={(e) => update("general", "secondaryColor", e.target.value)} className={swatch} />
                      <span className="self-center font-mono text-[13px] text-muted-foreground">{settings.general.secondaryColor}</span>
                    </div>
                  )}
                </Field>
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="features" className="mt-6 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
            <Section title="Features" description="Switch platform capabilities on or off.">
              <div className="divide-y divide-rule rounded-lg border">
                {PLATFORM_FEATURES.map((feature) => (
                  <ToggleRow
                    key={feature.key}
                    id={`feature-${feature.key}`}
                    title={feature.label}
                    description={feature.description}
                    checked={settings.features[feature.key as PlatformFeatureKey]}
                    onCheckedChange={(v) => update("features", feature.key as PlatformFeatureKey, v)}
                    unavailable={(UNAVAILABLE_SETTINGS as Partial<Record<string, string>>)[feature.key]}
                  />
                ))}
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="email" className="mt-6 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0 space-y-8">
            <Section title="Sending" description="Who platform email comes from.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="e-from-name" label="From name">{(id) => <Input id={id} value={settings.email.fromName} maxLength={80} onChange={(e) => update("email", "fromName", e.target.value)} />}</Field>
                <Field id="e-from" label="From email">{(id) => <Input id={id} type="email" value={settings.email.fromEmail} onChange={(e) => update("email", "fromEmail", e.target.value)} />}</Field>
                <Field id="e-reply" label="Reply-to email">{(id) => <Input id={id} type="email" value={settings.email.replyTo} onChange={(e) => update("email", "replyTo", e.target.value)} />}</Field>
                <Field id="e-smtp" label="Mail server" hint="Set by the server's environment (RESEND_API_KEY or SMTP_HOST).">
                  {(id) => <Input id={id} disabled value={transport ? `${transport.provider}${transport.host ? ` · ${transport.host}` : " · not configured"}` : ""} />}
                </Field>
              </div>
            </Section>
            <Section title="Test" description="Send a message through the real mail server.">
              <form noValidate onSubmit={(e) => { e.preventDefault(); sendTest() }} className="grid gap-3">
                <Field id="e-test-to" label="Send to" hint="Leave empty to send to your own account email.">
                  {(id) => (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input id={id} type="email" placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} className="flex-1" />
                      <Button type="submit" variant="outline" disabled={testing}>
                        {testing ? <Loader2 className="animate-spin" /> : <Send />}
                        Send test email
                      </Button>
                    </div>
                  )}
                </Field>
                {testResult && (
                  <p role="status" className={testResult.ok ? "text-[13px] text-positive" : "text-[13px] text-destructive"}>
                    {testResult.ok ? testResult.message : `Not sent: ${testResult.message}`}
                  </p>
                )}
              </form>
            </Section>
          </TabsContent>

          <TabsContent value="security" className="mt-6 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0 space-y-8">
            <Section title="Sign-in limits" description="Lockouts, sessions and passwords.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="s-attempts" label="Max login attempts" hint="Wrong passwords in a row (per email) before sign-in is locked.">{(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={50} value={Number.isNaN(settings.security.maxLoginAttempts) ? "" : settings.security.maxLoginAttempts} onChange={(e) => update("security", "maxLoginAttempts", toInt(e.target.value))} className="tabular-nums" />}</Field>
                <Field id="s-lockout" label="Lockout duration (minutes)" hint="How long a locked email stays locked.">{(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={1440} value={Number.isNaN(settings.security.lockoutMinutes) ? "" : settings.security.lockoutMinutes} onChange={(e) => update("security", "lockoutMinutes", toInt(e.target.value))} className="tabular-nums" />}</Field>
                <Field id="s-session" label="Session timeout (hours)" hint="People are signed out after this long without activity.">{(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={720} value={Number.isNaN(settings.security.sessionTimeoutHours) ? "" : settings.security.sessionTimeoutHours} onChange={(e) => update("security", "sessionTimeoutHours", toInt(e.target.value))} className="tabular-nums" />}</Field>
                <Field id="s-password" label="Min password length">{(id) => <Input id={id} type="number" inputMode="numeric" min={8} max={128} value={Number.isNaN(settings.security.minPasswordLength) ? "" : settings.security.minPasswordLength} onChange={(e) => update("security", "minPasswordLength", toInt(e.target.value))} className="tabular-nums" />}</Field>
              </div>
            </Section>
            <Section title="Admins" description="Extra protection for admin roles.">
              <div className="rounded-lg border">
                <ToggleRow id="s-2fa" title="Require 2FA for admins" description="Force two-factor authentication for all admin roles" checked={settings.security.require2faForAdmins} onCheckedChange={(v) => update("security", "require2faForAdmins", v)} unavailable={UNAVAILABLE_SETTINGS.require2faForAdmins} />
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-6 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
            <Section title="Maintenance" description="Take the platform offline for everyone but admins.">
              <div className="grid gap-4">
                <div className="rounded-lg border">
                  <ToggleRow id="m-mode" title="Maintenance mode" description="Enable maintenance mode to prevent user access" danger checked={settings.maintenance.enabled} onCheckedChange={(v) => update("maintenance", "enabled", v)} />
                </div>
                <Field id="m-message" label="Maintenance message">
                  {(id) => <Textarea id={id} placeholder="We're performing scheduled maintenance. We'll be back shortly!" rows={3} maxLength={500} value={settings.maintenance.message} onChange={(e) => update("maintenance", "message", e.target.value)} />}
                </Field>
              </div>
            </Section>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

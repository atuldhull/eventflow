"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useRBAC } from "@/hooks/useRBAC"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Section } from "../_components/admin-ui"
import { ImageDropZone } from "../_components/image-drop-zone"

const HEX = /^#[0-9a-fA-F]{6}$/

/** The enterprise's own colour is data, so it is shown as a real swatch. */
function ColourField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const valid = HEX.test(value)
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 pointer-coarse:size-11 [&::-moz-color-swatch]:rounded-[3px] [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[3px] [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          spellCheck={false}
          maxLength={7}
          aria-invalid={!valid || undefined}
          aria-describedby={!valid ? `${id}-error` : undefined}
          className="flex-1 font-mono"
        />
      </div>
      {!valid && <p id={`${id}-error`} className="text-xs text-destructive">Use a 6-digit hex colour like #1a2b3c</p>}
    </div>
  )
}

interface Branding { logo: string | null; banner: string | null; primaryColor: string; secondaryColor: string }

export default function EnterpriseBrandingPage() {
  const { currentEnterpriseId } = useRBAC()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<Branding>({ logo: null, banner: null, primaryColor: "#09090b", secondaryColor: "#ffffff" })
  const [saved, setSaved] = useState<Branding | null>(null)
  const [domain, setDomain] = useState({ slug: "", subdomain: "", customDomain: "" })
  const [domainInput, setDomainInput] = useState("")
  const [domainBusy, setDomainBusy] = useState(false)
  const [domainNote, setDomainNote] = useState<string | null>(null)

  useEffect(() => {
    if (!currentEnterpriseId) return
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/branding`)
        const json = await res.json()
        if (cancelled) return
        if (json.success && json.data) {
          const d = json.data
          const next: Branding = {
            logo: d.logo || null,
            banner: d.banner || null,
            primaryColor: d.primaryColor && HEX.test(d.primaryColor) ? d.primaryColor : "#09090b",
            secondaryColor: d.secondaryColor && HEX.test(d.secondaryColor) ? d.secondaryColor : "#ffffff",
          }
          setForm(next)
          setSaved(next)
          setDomain({ slug: d.slug || "", subdomain: d.subdomain || "", customDomain: d.customDomain || "" })
        } else {
          toast.error(json.message || "Failed to load branding")
        }
      } catch {
        if (!cancelled) toast.error("Failed to load branding")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentEnterpriseId])

  const save = async (patch: Partial<Branding>, successMessage = "Branding saved") => {
    if (!currentEnterpriseId) return false
    const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/branding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    const json = await res.json().catch(() => null)
    if (!json?.success) {
      toast.error(json?.message || "Failed to save")
      return false
    }
    setSaved((s) => ({ ...(s ?? form), ...patch }))
    toast.success(successMessage)
    return true
  }

  const handleSave = async () => {
    if (!HEX.test(form.primaryColor) || !HEX.test(form.secondaryColor)) {
      toast.error("Fix the colours before saving")
      return
    }
    setIsSaving(true)
    try {
      await save({ primaryColor: form.primaryColor, secondaryColor: form.secondaryColor })
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  // Images save as soon as they're uploaded or removed, so a dropped logo is never lost.
  const handleImage = async (key: "logo" | "banner", url: string | null) => {
    const previous = form[key]
    setForm((f) => ({ ...f, [key]: url }))
    const ok = await save({ [key]: url }, url ? `${key === "logo" ? "Logo" : "Banner"} updated` : `${key === "logo" ? "Logo" : "Banner"} removed`).catch(() => false)
    if (!ok) setForm((f) => ({ ...f, [key]: previous }))
  }

  const verifyDomain = async () => {
    if (!currentEnterpriseId || !domainInput.trim()) return
    setDomainBusy(true)
    setDomainNote(null)
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/domain/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) { toast.error(json?.message || "Verification failed"); return }
      if (json.data?.verified) {
        setDomain((d) => ({ ...d, customDomain: json.data.domain }))
        setDomainInput("")
        toast.success(json.message || "Domain connected")
      } else {
        setDomainNote(json.message || "DNS isn't pointing here yet.")
      }
    } catch {
      toast.error("Verification failed")
    } finally {
      setDomainBusy(false)
    }
  }

  const removeDomain = async () => {
    if (!currentEnterpriseId) return
    setDomainBusy(true)
    try {
      const res = await fetch(`/api/admin/enterprise/${currentEnterpriseId}/domain/remove`, { method: "POST" })
      const json = await res.json().catch(() => null)
      if (!json?.success) { toast.error(json?.message || "Failed to remove domain"); return }
      setDomain((d) => ({ ...d, customDomain: "" }))
      toast.success("Custom domain removed")
    } catch {
      toast.error("Failed to remove domain")
    } finally {
      setDomainBusy(false)
    }
  }

  const coloursDirty = !!saved && (saved.primaryColor !== form.primaryColor || saved.secondaryColor !== form.secondaryColor)
  const swatch = (c: string) => (HEX.test(c) ? c : "transparent")

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Branding"
        description="How your enterprise appears on the platform"
        actions={
          <Button onClick={handleSave} disabled={isSaving || isLoading || !coloursDirty}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Brand identity" description="Your logo and the banner on your enterprise page. Changes save on upload.">
            <div className="grid gap-5">
              <ImageDropZone label="Logo" hint="PNG, JPG or WebP, up to 5MB" value={form.logo} onChange={(url) => handleImage("logo", url)} />
              <ImageDropZone label="Banner image" variant="banner" hint="1920×400 recommended · PNG, JPG or WebP" value={form.banner} onChange={(url) => handleImage("banner", url)} />
            </div>
          </Section>

          <Section title="Colours" description="Used on your enterprise page and emails.">
            <div className="grid gap-4 sm:grid-cols-2">
              <ColourField id="brand-primary" label="Primary colour" value={form.primaryColor} onChange={(v) => setForm((f) => ({ ...f, primaryColor: v }))} />
              <ColourField id="brand-secondary" label="Secondary colour" value={form.secondaryColor} onChange={(v) => setForm((f) => ({ ...f, secondaryColor: v }))} />
            </div>
            <div className="mt-4">
              <div className="flex h-10 overflow-hidden rounded-md border" aria-hidden>
                <span className="flex-3" style={{ backgroundColor: swatch(form.primaryColor) }} />
                <span className="flex-1" style={{ backgroundColor: swatch(form.secondaryColor) }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {coloursDirty ? "Unsaved colours" : "Saved colours"}: <span className="font-mono">{form.primaryColor}</span> and <span className="font-mono">{form.secondaryColor}</span>
              </p>
            </div>
          </Section>

          <Section title="Domain" description="Where your enterprise page lives.">
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="brand-subdomain">Subdomain</Label>
                <Input id="brand-subdomain" disabled value={domain.subdomain || `${domain.slug}.eventflow.com`} />
                <p className="text-xs text-muted-foreground">Assigned automatically.</p>
              </div>
              {domain.customDomain ? (
                <div className="grid gap-1.5">
                  <p className="text-sm font-medium">Custom domain</p>
                  <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-sm">{domain.customDomain}</span>
                    <Button type="button" variant="outline" size="sm" onClick={removeDomain} disabled={domainBusy}>
                      {domainBusy && <Loader2 className="animate-spin" />}
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <form noValidate onSubmit={(e) => { e.preventDefault(); verifyDomain() }} className="grid gap-1.5">
                  <Label htmlFor="brand-domain">Custom domain</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="brand-domain"
                      placeholder="events.youruniversity.edu"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      aria-describedby="brand-domain-hint"
                      spellCheck={false}
                      className="flex-1"
                    />
                    <Button type="submit" variant="outline" disabled={domainBusy || !domainInput.trim()}>
                      {domainBusy && <Loader2 className="animate-spin" />}
                      Verify & connect
                    </Button>
                  </div>
                  <p id="brand-domain-hint" className="text-xs text-muted-foreground">
                    Add a CNAME record pointing to <span className="font-mono">cname.eventflow.com</span>, then verify. The domain connects once DNS checks out.
                  </p>
                  {domainNote && <p role="status" className="text-xs text-warning">{domainNote}</p>}
                </form>
              )}
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

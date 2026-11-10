"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronRight, Copy, Check, ExternalLink, Eye, FileText, ImageIcon, Layout, Loader2, Paintbrush, Palette } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any -- site config JSON is loosely typed by the API */
interface SiteConfigData {
  id: string
  siteName: string
  isPublished: boolean
  publishedAt: string | null
  lastEditedAt: string | null
  sections: any[]
  enabledFeatures: any[]
  styles: any
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface TemplateInfo {
  id: string
  name: string
  slug: string
  category: string
  thumbnail: string | null
}

export default function MyWebsitePage() {
  const { currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null)
  const [template, setTemplate] = useState<TemplateInfo | null>(null)
  const [exists, setExists] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetch_() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/website`)
        const json = await res.json()
        if (json.success) {
          setExists(json.exists)
          if (json.exists) {
            setSiteConfig(json.siteConfig)
            setTemplate(json.template)
          }
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [currentOrganizationId])

  const handlePublishToggle = async () => {
    if (!currentOrganizationId || !siteConfig) return
    setIsPublishing(true)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: !siteConfig.isPublished }),
      })
      const json = await res.json()
      if (json.success) {
        setSiteConfig(json.siteConfig)
        toast.success(json.siteConfig.isPublished ? "Website published!" : "Website unpublished")
      } else {
        toast.error(json.message)
      }
    } catch { toast.error("Failed to update") } finally { setIsPublishing(false) }
  }

  const copyUrl = () => {
    const url = `${org?.slug || "org"}.eventflow.com`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("URL copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-80" /></div>
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    )
  }

  const siteUrl = `${org?.slug || "org"}.eventflow.com`
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const enabledSections = siteConfig?.sections?.filter((s: any) => s.enabled)?.length || 0
  const enabledFeatures = siteConfig?.enabledFeatures?.filter((f: any) => f.enabled)?.length || 0
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ── Onboarding (no site config) ──
  if (!exists) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.015em]">Website</h1>
          <p className="text-sm text-muted-foreground">Your organization doesn&apos;t have a website yet.</p>
        </div>
        <Card className="gap-0 p-0">
          <div className="flex flex-col gap-4 border-b border-rule p-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <h2 className="text-lg font-semibold">Create your website</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a template and build your organization&apos;s website in minutes. It will be live at{" "}
                <span className="font-mono text-[13px] text-foreground">{siteUrl}</span>
              </p>
            </div>
            <Link href="/admin/org/website/templates" className={cn(buttonVariants(), "max-sm:w-full")}>Browse templates</Link>
          </div>
          <ol className="grid divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              { title: "Choose a template", desc: "Pick from our curated collection of professional designs" },
              { title: "Customize everything", desc: "Add your content, change colors, enable features" },
              { title: "Go live instantly", desc: `Your website is live at ${siteUrl}` },
            ].map((item, i) => (
              <li key={item.title} className="p-6">
                <span className="text-[13px] text-muted-foreground tabular-nums">Step {i + 1}</span>
                <h3 className="mt-1 text-[15px] font-semibold">{item.title}</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">{item.desc}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    )
  }

  const actions = [
    { icon: Paintbrush, label: "Edit content", href: "/admin/org/website/editor", desc: "Customize sections and content" },
    { icon: Palette, label: "Change template", href: "/admin/org/website/templates", desc: "Browse other designs" },
    { icon: Layout, label: "Feature modules", href: "/admin/org/website/modules", desc: "Enable interactive features" },
    { icon: Eye, label: "Preview", href: "/admin/org/website/templates/" + (template?.slug || ""), desc: "See how it looks" },
    { icon: FileText, label: "Content overview", href: "/admin/org/website/content", desc: "Everything on your website at a glance" },
    { icon: ImageIcon, label: "Media library", href: "/admin/org/website/media", desc: "Images and files used on your site" },
  ]

  // ── Dashboard (site config exists) ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.015em]">{siteConfig?.siteName || "My Website"}</h1>
            <Pill tone={siteConfig?.isPublished ? "positive" : "neutral"} dot>{siteConfig?.isPublished ? "Published" : "Draft"}</Pill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {template?.name || "Unknown"} template · {enabledSections} sections · {enabledFeatures} features
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={copyUrl} className="min-w-0 max-sm:flex-1" aria-label={`Copy ${siteUrl}`}>
            {copied ? <Check /> : <Copy />}
            <span className="truncate font-mono text-[13px] font-normal">{siteUrl}</span>
          </Button>
          <a href={`https://${siteUrl}`} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "max-sm:flex-1")}>
            <ExternalLink /> Visit
          </a>
          <Button variant={siteConfig?.isPublished ? "outline" : "default"} onClick={handlePublishToggle} disabled={isPublishing} className="max-sm:flex-1">
            {isPublishing && <Loader2 className="animate-spin" />}
            {siteConfig?.isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        <dl className="grid grid-cols-2 md:grid-cols-4 [&>div]:border-rule max-md:[&>div:nth-child(n+3)]:border-t md:divide-x md:divide-rule max-md:[&>div:nth-child(even)]:border-l">
          {[
            { label: "Status", value: siteConfig?.isPublished ? "Live" : "Draft" },
            { label: "Template", value: template?.name || "—" },
            { label: "Active sections", value: String(enabledSections) },
            { label: "Last edited", value: siteConfig?.lastEditedAt ? new Date(siteConfig.lastEditedAt).toLocaleDateString() : "—" },
          ].map((it) => (
            <div key={it.label} className="min-w-0 px-5 py-4">
              <dt className="text-[13px] text-muted-foreground">{it.label}</dt>
              <dd className="mt-1 truncate text-[15px] font-medium tabular-nums">{it.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <section aria-labelledby="site-actions" className="space-y-3">
        <h2 id="site-actions" className="text-[15px] font-semibold">Manage</h2>
        <ul className="grid overflow-hidden rounded-lg border sm:grid-cols-2 [&>li]:border-rule max-sm:[&>li+li]:border-t sm:[&>li:nth-child(n+3)]:border-t sm:[&>li:nth-child(even)]:border-l">
          {actions.map((action) => (
            <li key={action.label}>
              <Link href={action.href} className="group flex min-h-16 items-center gap-3.5 px-4 py-3 transition-colors hover:bg-muted/50">
                <action.icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{action.label}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{action.desc}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint transition-colors group-hover:text-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

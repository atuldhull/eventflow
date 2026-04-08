"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Globe, Layout, Palette, Paintbrush, ExternalLink, Copy, Check, Loader2, Rocket, Sparkles, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"

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

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  const siteUrl = `${org?.slug || "org"}.eventflow.com`
  const enabledSections = siteConfig?.sections?.filter((s: any) => s.enabled)?.length || 0
  const enabledFeatures = siteConfig?.enabledFeatures?.filter((f: any) => f.enabled)?.length || 0

  // ── ONBOARDING (no site config) ──
  if (!exists) {
    return (
      <div className="max-w-4xl mx-auto space-y-10 py-8">
        <motion.div className="text-center space-y-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Globe className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Create Your Website</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Choose a template and build your organization's website in minutes. It will be live at <strong>{siteUrl}</strong>
          </p>
          <Link href="/admin/org/website/templates">
            <Button size="lg" className="gap-2 mt-2"><Sparkles className="h-4 w-4" />Browse Templates</Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: <Palette className="h-6 w-6" />, title: "Choose a Template", desc: "Pick from our curated collection of professional designs" },
            { icon: <Paintbrush className="h-6 w-6" />, title: "Customize Everything", desc: "Add your content, change colors, enable features" },
            { icon: <Rocket className="h-6 w-6" />, title: "Go Live Instantly", desc: `Your website is live at ${siteUrl}` },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}>
              <Card className="p-6 text-center space-y-2 h-full">
                <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">{item.icon}</div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  // ── DASHBOARD (site config exists) ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {siteConfig?.siteName || "My Website"}
            <Badge variant={siteConfig?.isPublished ? "default" : "secondary"}>
              {siteConfig?.isPublished ? "Published" : "Draft"}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Template: {template?.name || "Unknown"} &bull; {enabledSections} sections &bull; {enabledFeatures} features
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={copyUrl}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{siteUrl}
          </Button>
          <a href={`https://${siteUrl}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1"><ExternalLink className="h-3.5 w-3.5" />Visit</Button>
          </a>
          <Button size="sm" variant={siteConfig?.isPublished ? "outline" : "default"} className="gap-1" onClick={handlePublishToggle} disabled={isPublishing}>
            {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {siteConfig?.isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Paintbrush className="h-5 w-5" />, label: "Edit Content", href: "/admin/org/website/editor", desc: "Customize sections and content" },
          { icon: <Palette className="h-5 w-5" />, label: "Change Template", href: "/admin/org/website/templates", desc: "Browse other designs" },
          { icon: <Layout className="h-5 w-5" />, label: "Feature Modules", href: "/admin/org/website/modules", desc: "Enable interactive features" },
          { icon: <Eye className="h-5 w-5" />, label: "Preview", href: "/admin/org/website/templates/" + (template?.slug || ""), desc: "See how it looks" },
        ].map((action) => (
          <Link key={action.label} href={action.href}>
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="text-primary mb-2">{action.icon}</div>
              <h3 className="font-medium text-sm">{action.label}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Status */}
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Website Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Status</p>
            <p className="font-medium">{siteConfig?.isPublished ? "Live" : "Draft"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Template</p>
            <p className="font-medium">{template?.name || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Active Sections</p>
            <p className="font-medium">{enabledSections}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Last Edited</p>
            <p className="font-medium">{siteConfig?.lastEditedAt ? new Date(siteConfig.lastEditedAt).toLocaleDateString() : "—"}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

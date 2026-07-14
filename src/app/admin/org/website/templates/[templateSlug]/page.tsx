"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, Monitor, Tablet, Smartphone, Check, Loader2, AlertTriangle, Star, Puzzle, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { TemplatePreview } from "@/components/website/TemplatePreview"
import { useRBAC } from "@/hooks/useRBAC"

interface Template {
  id: string
  name: string
  slug: string
  description: string
  longDescription: string | null
  category: string
  tags: string[]
  isPremium: boolean
  isFeatured: boolean
  requiredPlan: string
  installCount: number
  rating: number
  ratingCount: number
  supportedFeatures: string[]
  defaultSections: any[]
  defaultStyles: any
  version: string
  author: string | null
  isCurrentTemplate: boolean
  canApply: boolean
}

export default function TemplatePreviewPage({ params }: { params: Promise<{ templateSlug: string }> }) {
  const router = useRouter()
  const { currentOrganizationId, accessibleOrganizations } = useRBAC()
  const org = accessibleOrganizations.find((o) => o.id === currentOrganizationId)
  const [template, setTemplate] = useState<Template | null>(null)
  const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop")
  const [isLoading, setIsLoading] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [templateSlug, setTemplateSlug] = useState("")

  useEffect(() => {
    params.then((p) => setTemplateSlug(p.templateSlug))
  }, [params])

  useEffect(() => {
    if (!currentOrganizationId || !templateSlug) return
    async function fetch_() {
      try {
        const [tplRes, siteRes] = await Promise.all([
          fetch(`/api/admin/org/${currentOrganizationId}/website/templates`),
          fetch(`/api/admin/org/${currentOrganizationId}/website`),
        ])
        const tplJson = await tplRes.json()
        const siteJson = await siteRes.json()

        if (tplJson.success) {
          const found = tplJson.data.find((t: Template) => t.slug === templateSlug)
          setTemplate(found || null)
        }
        if (siteJson.success) setHasExisting(siteJson.exists)
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [currentOrganizationId, templateSlug])

  const handleApply = async () => {
    if (!currentOrganizationId || !template) return
    setIsApplying(true)

    try {
      if (hasExisting) {
        // Change template
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/website`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateSlug: template.slug }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success("Template changed! Review your content in the editor.")
          router.push("/admin/org/website")
        } else {
          toast.error(json.message)
        }
      } else {
        // First time — create site config
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/website`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateSlug: template.slug }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success("Website created! Let's customize it.")
          router.push("/admin/org/website")
        } else {
          toast.error(json.message)
        }
      }
    } catch {
      toast.error("Failed to apply template")
    } finally {
      setIsApplying(false)
      setShowConfirm(false)
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!template) return <div className="text-center py-20"><p className="text-muted-foreground">Template not found</p><Link href="/admin/org/website/templates"><Button variant="link">Back to Templates</Button></Link></div>

  const sections = template.defaultSections || []
  const styles = template.defaultStyles || {}

  return (
    <div className="space-y-4 -mx-2 sm:-mx-4">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/org/website/templates">
            <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="font-semibold text-sm">{template.name}</h1>
            <Badge variant="secondary" className="text-[10px]">{template.category}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Device toggle */}
          <div className="hidden sm:flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <Button onClick={() => setShowSidebar(!showSidebar)} variant="ghost" size="sm" className="hidden md:flex text-xs">
            {showSidebar ? "Hide Info" : "Show Info"}
          </Button>

          {template.canApply ? (
            <Button onClick={() => setShowConfirm(true)} disabled={template.isCurrentTemplate || isApplying} className="gap-1">
              {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {template.isCurrentTemplate ? "Current Template" : "Use This Template"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => router.push("/admin/org/billing")} className="gap-1">
              <Lock className="h-4 w-4" />
              Upgrade to {template.requiredPlan}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-4 px-2 sm:px-4">
        {/* Preview */}
        <div className="flex-1 min-w-0">
          <TemplatePreview
            sections={sections}
            styles={styles}
            viewMode={viewMode}
            isInteractive={false}
            orgSlug={org?.slug || "preview"}
          />
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <motion.div className="hidden md:block w-72 shrink-0 space-y-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">{template.name}</h3>
              <p className="text-sm text-muted-foreground">{template.longDescription || template.description}</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><Badge variant="secondary" className="text-[10px]">{template.category}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium">{template.requiredPlan}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Installs</span><span>{template.installCount}</span></div>
                {template.ratingCount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Rating</span><span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{template.rating.toFixed(1)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span>{template.version}</span></div>
                {template.author && <div className="flex justify-between"><span className="text-muted-foreground">Author</span><span>{template.author}</span></div>}
              </div>
            </Card>

            <Card className="p-4 space-y-2">
              <h4 className="font-medium text-sm">Sections ({sections.length})</h4>
              <div className="space-y-1">
                {sections.filter((s: any) => s.enabled).map((s: any) => (
                  <div key={s.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {s.type.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </div>
                ))}
              </div>
            </Card>

            {template.supportedFeatures.length > 0 && (
              <Card className="p-4 space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-1"><Puzzle className="h-3.5 w-3.5" />Supported Features</h4>
                <div className="flex flex-wrap gap-1">
                  {template.supportedFeatures.map((f: string) => (
                    <Badge key={f} variant="outline" className="text-[10px]">{f.replace(/-/g, " ")}</Badge>
                  ))}
                </div>
              </Card>
            )}

            {template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {template.tags.map((tag: string) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowConfirm(false)}>
          <motion.div className="bg-background rounded-xl p-6 max-w-md w-full shadow-xl space-y-4" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
            {hasExisting ? (
              <>
                <h3 className="text-lg font-bold">Change to {template.name}?</h3>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="text-sm space-y-1">
                    <p className="font-medium">This will replace your current section layout</p>
                    <p>Your custom content (text, images) will be preserved where possible, but section order and configuration will change. Your enabled feature modules will not be affected.</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
                  I understand my layout will change
                </label>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
                  <Button onClick={handleApply} disabled={!confirmChecked || isApplying}>
                    {isApplying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Change Template
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold">Create your website with {template.name}?</h3>
                <p className="text-sm text-muted-foreground">Your website will be live at <strong>{org?.slug || "org"}.eventflow.com</strong>. You can customize everything after setup.</p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
                  <Button onClick={handleApply} disabled={isApplying}>
                    {isApplying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Create Website
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  )
}

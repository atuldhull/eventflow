"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Monitor, Tablet, Smartphone, Loader2, AlertTriangle, Star, Lock, PanelRightClose, PanelRightOpen, LayoutTemplate } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { toast } from "sonner"
import { TemplatePreview } from "@/components/website/TemplatePreview"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any -- template JSON is loosely typed by the API */
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

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()
const breadcrumbsFor = (name?: string) => [
  { label: "Website", href: "/admin/org/website" },
  { label: "Templates", href: "/admin/org/website/templates" },
  ...(name ? [{ label: name }] : []),
]

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

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader title="Template" breadcrumbs={breadcrumbsFor()} />
        <Skeleton className="h-[60vh] rounded-lg" />
      </div>
    )
  }
  if (!template) {
    return (
      <div className="space-y-6">
        <PageHeader title="Template" breadcrumbs={breadcrumbsFor()} />
        <EmptyState icon={LayoutTemplate} title="Template not found">
          <Link href="/admin/org/website/templates" className={buttonVariants({ variant: "outline" })}>Back to templates</Link>
        </EmptyState>
      </div>
    )
  }

  const sections = template.defaultSections || []
  const styles = template.defaultStyles || {}

  return (
    <div className="space-y-5">
      <PageHeader
        title={template.name}
        description={`${titleCase(template.category)} template`}
        breadcrumbs={breadcrumbsFor(template.name)}
        actions={
          <>
            <div className="hidden items-center rounded-md border p-0.5 sm:flex" role="group" aria-label="Preview size">
              {([["desktop", Monitor, "Desktop"], ["tablet", Tablet, "Tablet"], ["mobile", Smartphone, "Phone"]] as const).map(([mode, Icon, label]) => (
                <Button
                  key={mode}
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setViewMode(mode)}
                  aria-label={`${label} preview`}
                  aria-pressed={viewMode === mode}
                  className={cn("rounded-[4px]", viewMode === mode ? "bg-accent text-foreground" : "text-muted-foreground")}
                >
                  <Icon />
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => setShowSidebar(!showSidebar)}
              className="hidden md:inline-flex"
              aria-pressed={showSidebar}
            >
              {showSidebar ? <PanelRightClose /> : <PanelRightOpen />}
              {showSidebar ? "Hide info" : "Show info"}
            </Button>
            {template.canApply ? (
              <Button onClick={() => setShowConfirm(true)} disabled={template.isCurrentTemplate || isApplying}>
                {isApplying && <Loader2 className="animate-spin" />}
                {template.isCurrentTemplate ? "Current template" : "Use this template"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => router.push("/admin/org/billing")}>
                <Lock />
                Upgrade to {template.requiredPlan}
              </Button>
            )}
          </>
        }
      />

      <div className="flex gap-5">
        {/* Preview (the tenant's own design) */}
        <div className="min-w-0 flex-1 rounded-lg bg-raised p-3 sm:p-5">
          <TemplatePreview
            sections={sections}
            styles={styles}
            viewMode={viewMode}
            isInteractive={false}
            orgSlug={org?.slug || "preview"}
          />
        </div>

        {/* Info */}
        {showSidebar && (
          <aside className="hidden w-72 shrink-0 space-y-4 md:block" aria-label="Template details">
            <Card className="gap-0 p-0">
              <div className="space-y-1.5 px-4 py-3.5">
                <h2 className="text-[15px] font-semibold">{template.name}</h2>
                <p className="text-[13px] text-muted-foreground">{template.longDescription || template.description}</p>
              </div>
              <dl className="divide-y divide-rule border-t border-rule text-[13px]">
                <div className="flex justify-between gap-3 px-4 py-2"><dt className="text-muted-foreground">Category</dt><dd>{titleCase(template.category)}</dd></div>
                <div className="flex justify-between gap-3 px-4 py-2"><dt className="text-muted-foreground">Plan</dt><dd className="font-medium">{template.requiredPlan}</dd></div>
                <div className="flex justify-between gap-3 px-4 py-2"><dt className="text-muted-foreground">Installs</dt><dd className="tabular-nums">{template.installCount}</dd></div>
                {template.ratingCount > 0 && (
                  <div className="flex justify-between gap-3 px-4 py-2"><dt className="text-muted-foreground">Rating</dt><dd className="flex items-center gap-1 tabular-nums"><Star className="size-3 fill-current" aria-hidden />{template.rating.toFixed(1)}</dd></div>
                )}
                <div className="flex justify-between gap-3 px-4 py-2"><dt className="text-muted-foreground">Version</dt><dd className="font-mono">{template.version}</dd></div>
                {template.author && <div className="flex justify-between gap-3 px-4 py-2"><dt className="text-muted-foreground">Author</dt><dd>{template.author}</dd></div>}
              </dl>
            </Card>

            <Card className="gap-0 p-0">
              <h3 className="border-b border-rule px-4 py-2.5 text-sm font-medium">
                Sections <span className="font-normal text-muted-foreground tabular-nums">{sections.length}</span>
              </h3>
              <ul className="space-y-1 px-4 py-3">
                {sections.filter((s: any) => s.enabled).map((s: any) => (
                  <li key={s.id} className="text-[13px] text-muted-foreground">
                    {s.type.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </li>
                ))}
              </ul>
            </Card>

            {template.supportedFeatures.length > 0 && (
              <Card className="gap-0 p-0">
                <h3 className="border-b border-rule px-4 py-2.5 text-sm font-medium">Supported features</h3>
                <div className="flex flex-wrap gap-1 px-4 py-3">
                  {template.supportedFeatures.map((f: string) => (
                    <span key={f} className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{f.replace(/-/g, " ")}</span>
                  ))}
                </div>
              </Card>
            )}

            {template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {template.tags.map((tag: string) => (
                  <span key={tag} className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Confirmation */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          {hasExisting ? (
            <>
              <DialogHeader>
                <DialogTitle>Change to {template.name}?</DialogTitle>
                <DialogDescription>This will replace your current section layout.</DialogDescription>
              </DialogHeader>
              <div className="flex items-start gap-2.5 rounded-md bg-pill-warning px-3 py-2.5 text-[13px] text-pill-warning-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>Your custom content (text, images) will be preserved where possible, but section order and configuration will change. Your enabled feature modules will not be affected.</p>
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={confirmChecked} onCheckedChange={(v) => setConfirmChecked(!!v)} />
                I understand my layout will change
              </label>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
                <Button onClick={handleApply} disabled={!confirmChecked || isApplying}>
                  {isApplying && <Loader2 className="animate-spin" />}Change template
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create your website with {template.name}?</DialogTitle>
                <DialogDescription>
                  Your website will be live at <span className="font-mono text-foreground">{org?.slug || "org"}.eventflow.com</span>. You can customize everything after setup.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
                <Button onClick={handleApply} disabled={isApplying}>
                  {isApplying && <Loader2 className="animate-spin" />}Create website
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
/* eslint-enable @typescript-eslint/no-explicit-any */

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, Check, ChevronRight, Circle, FileText, Globe, ImageIcon, Layout, Paintbrush, Puzzle, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"

interface ContentStats {
  sections: { homepage: number; total: number }
  pages: { total: number }
  modules: { enabled: number; total: number }
  media: { total: number; totalSizeMB: number }
  moduleContent: Record<string, number>
  completeness: { score: number; items: { key: string; label: string; done: boolean; action?: string }[] }
}

const breadcrumbs = [{ label: "Website", href: "/admin/org/website" }, { label: "Content" }]

export default function ContentOverviewPage() {
  const { currentOrganizationId } = useRBAC()
  const [stats, setStats] = useState<ContentStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganizationId) return
    async function load() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/content-stats`)
        const json = await res.json()
        if (json.success && json.exists) setStats(json)
      } catch {} finally { setIsLoading(false) }
    }
    load()
  }, [currentOrganizationId])

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader title="Content" description="Everything on your website at a glance" breadcrumbs={breadcrumbs} />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (!stats) return (
    <div className="space-y-6">
      <PageHeader title="Content" breadcrumbs={breadcrumbs} />
      <EmptyState variant="page" icon={Globe} title="No website configured yet">
        <Link href="/admin/org/website" className={buttonVariants()}>Set up website</Link>
      </EmptyState>
    </div>
  )

  const completedCount = stats.completeness.items.filter((i) => i.done).length
  const totalChecks = stats.completeness.items.length

  const figures = [
    { label: "Sections", value: String(stats.sections.homepage), sub: `${stats.sections.total} total`, href: "/admin/org/website/editor" },
    { label: "Pages", value: String(stats.pages.total), sub: "including homepage", href: "/admin/org/website/editor" },
    { label: "Modules", value: `${stats.modules.enabled}/${stats.modules.total}`, sub: "enabled", href: "/admin/org/website/modules" },
    { label: "Media", value: String(stats.media.total), sub: `${stats.media.totalSizeMB} MB`, href: "/admin/org/website/media" },
  ]

  const quickActions = [
    { icon: Paintbrush, label: "Edit homepage", href: "/admin/org/website/editor" },
    { icon: ImageIcon, label: "Upload images", href: "/admin/org/website/media" },
    { icon: Search, label: "Update SEO", href: "/admin/org/website/editor" },
    { icon: Puzzle, label: "Browse modules", href: "/admin/org/website/modules" },
    { icon: FileText, label: "Add page", href: "/admin/org/website/editor" },
    { icon: Layout, label: "Change template", href: "/admin/org/website/templates" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Content" description="Everything on your website at a glance" breadcrumbs={breadcrumbs} />

      {/* Figures: each opens its section */}
      <Card className="gap-0 overflow-hidden p-0">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {figures.map((s, i) => (
            <Link
              key={s.label}
              href={s.href}
              className={cn(
                "group block px-5 py-4 transition-colors hover:bg-muted/50",
                i % 2 === 1 && "border-l",
                i >= 2 && "max-lg:border-t",
                i === 2 && "lg:border-l",
              )}
            >
              <dt className="flex items-center justify-between text-sm text-muted-foreground">
                {s.label}
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </dt>
              <dd className="mt-1.5 text-[26px] leading-8 tracking-[-0.02em] tabular-nums">{s.value}</dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">{s.sub}</dd>
            </Link>
          ))}
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Completeness */}
        <Card className="gap-0 p-0">
          <div className="border-b border-rule px-5 py-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-[15px] font-semibold">Website completeness</h2>
              <span className="text-[22px] leading-7 tracking-[-0.02em] tabular-nums">{stats.completeness.score}%</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-[2px] bg-muted"
              role="progressbar"
              aria-label="Website completeness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stats.completeness.score}
            >
              <div className="h-full rounded-[2px] bg-brand" style={{ width: `${stats.completeness.score}%` }} />
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground tabular-nums">{completedCount} of {totalChecks} items complete</p>
          </div>
          <ul className="divide-y divide-rule">
            {stats.completeness.items.map((item) => (
              <li key={item.key} className="flex min-h-11 items-center gap-3 px-5 py-2">
                {item.done ? (
                  <Check className="size-4 shrink-0 text-positive" aria-label="Done" />
                ) : (
                  <Circle className="size-4 shrink-0 text-faint" aria-label="To do" />
                )}
                <span className={cn("flex-1 text-sm", item.done && "text-muted-foreground")}>{item.label}</span>
                {!item.done && item.action && (
                  <Link href={item.action} className={buttonVariants({ variant: "ghost", size: "xs" })}>Fix</Link>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          {/* Quick actions */}
          <section aria-labelledby="quick-heading" className="space-y-3">
            <h2 id="quick-heading" className="text-[15px] font-semibold">Quick actions</h2>
            <ul className="divide-y divide-rule overflow-hidden rounded-lg border">
              {quickActions.map((action) => (
                <li key={action.label}>
                  <Link href={action.href} className="group flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50">
                    <action.icon className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                    <span className="flex-1">{action.label}</span>
                    <ChevronRight className="size-4 text-faint transition-colors group-hover:text-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Module content */}
          {Object.keys(stats.moduleContent).length > 0 && (
            <section aria-labelledby="modules-heading" className="space-y-3">
              <h2 id="modules-heading" className="text-[15px] font-semibold">Module content</h2>
              <ul className="divide-y divide-rule overflow-hidden rounded-lg border">
                {Object.entries(stats.moduleContent).map(([moduleId, count]) => (
                  <li key={moduleId}>
                    <Link href={`/admin/org/website/modules/${moduleId}/manage`} className="group flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50">
                      <span className="flex-1">{moduleId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</span>
                      <span className="tabular-nums">{count}</span>
                      <span className="text-[13px] text-muted-foreground">entries</span>
                      <ChevronRight className="size-4 text-faint transition-colors group-hover:text-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

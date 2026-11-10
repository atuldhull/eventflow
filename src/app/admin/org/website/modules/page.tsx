"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Award, CalendarDays, ChartColumn, CircleHelp, Clock, CloudSun, FileText, HandHeart, Images, Loader2, Package, Puzzle,
  ShoppingBag, Star, Timer, Trophy, Users, type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTableSearch } from "@/components/tables/DataTableToolbar"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any -- module schemas are loosely typed by the API */
interface Module {
  id: string; moduleId: string; name: string; description: string; shortDescription: string | null
  icon: string; category: string; configSchema: any; defaultConfig: any
  hasAdminPanel: boolean; requiredPlan: string; supportedPlacements: string[]
  isPremium: boolean; isBeta: boolean; isNew: boolean; sortOrder: number
  installCount: number; rating: number; ratingCount: number; setupGuide: string | null
  isEnabled: boolean; currentConfig: any; dataCount: number; lastActivity: string | null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const CATEGORIES = [
  { id: "ALL", label: "All" },
  { id: "ENGAGEMENT", label: "Engagement" },
  { id: "CONTENT", label: "Content" },
  { id: "SOCIAL", label: "Social" },
  { id: "GAMIFICATION", label: "Gamification" },
  { id: "COMMERCE", label: "Commerce" },
  { id: "UTILITY", label: "Utility" },
]

/** Module icon names from the registry, drawn as plain grey glyphs */
const MODULE_ICONS: Record<string, LucideIcon> = {
  HelpCircle: CircleHelp, BarChart2: ChartColumn, Timer, Trophy, Images, FileText, Award, Users,
  CalendarDays, HandHeart, ShoppingBag, CloudSun,
}

const PLAN_LABEL: Record<string, string> = { FREE: "Free", STARTER: "Starter", PRO: "Pro" }

const COMING_SOON = [
  { name: "Live Streaming", desc: "Stream events directly on your website", eta: "Q3 2026" },
  { name: "AI Chatbot", desc: "Answer visitor questions with AI", eta: "Q4 2026" },
  { name: "Donation Widget", desc: "Accept donations for your cause", eta: "Q3 2026" },
  { name: "Scavenger Hunt", desc: "Gamified treasure hunt for events", eta: "Q4 2026" },
  { name: "Live Q&A", desc: "Real-time question and answer sessions", eta: "Q3 2026" },
]

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

function ModuleIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MODULE_ICONS[name] ?? Package
  return <Icon className={cn("size-5 shrink-0 text-muted-foreground", className)} strokeWidth={1.6} aria-hidden />
}

export default function ModuleMarketplacePage() {
  const router = useRouter()
  const { currentOrganizationId } = useRBAC()
  const [modules, setModules] = useState<Module[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"marketplace" | "enabled" | "coming-soon">("marketplace")
  const [activeCategory, setActiveCategory] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [enablingId, setEnablingId] = useState<string | null>(null)
  const [detailModule, setDetailModule] = useState<Module | null>(null)

  useEffect(() => {
    if (!currentOrganizationId) return
    fetchModules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganizationId])

  async function fetchModules() {
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/modules`)
      const json = await res.json()
      if (json.success) setModules(json.modules)
    } catch {} finally { setIsLoading(false) }
  }

  const handleEnable = async (moduleId: string) => {
    if (!currentOrganizationId) return
    setEnablingId(moduleId)
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/modules/${moduleId}/enable`, { method: "POST" })
      const json = await res.json()
      if (json.success) {
        toast.success("Module enabled!")
        fetchModules()
        router.push(`/admin/org/website/modules/${moduleId}/config`)
      } else toast.error(json.message)
    } catch { toast.error("Failed to enable") } finally { setEnablingId(null) }
  }

  const handleDisable = async (moduleId: string) => {
    if (!currentOrganizationId) return
    try {
      const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/modules/${moduleId}/disable`, { method: "POST" })
      const json = await res.json()
      if (json.success) { toast.success("Module disabled"); fetchModules() }
      else toast.error(json.message)
    } catch { toast.error("Failed to disable") }
  }

  const filtered = useMemo(() => {
    let result = [...modules]
    if (activeCategory !== "ALL") result = result.filter((m) => m.category === activeCategory)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((m) => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))
    }
    return result
  }, [modules, activeCategory, searchQuery])

  const enabledModules = modules.filter((m) => m.isEnabled)

  const header = (
    <PageHeader
      title="Feature modules"
      description="Add interactive features to your website"
      breadcrumbs={[{ label: "Website", href: "/admin/org/website" }, { label: "Modules" }]}
    />
  )

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        {header}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="gap-5">
        <TabsList variant="line">
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="enabled">Enabled <span className="text-muted-foreground tabular-nums">{enabledModules.length}</span></TabsTrigger>
          <TabsTrigger value="coming-soon">Coming soon</TabsTrigger>
        </TabsList>

        {/* Marketplace */}
        <TabsContent value="marketplace" className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Category">
              {CATEGORIES.map((cat) => {
                const count = cat.id === "ALL" ? modules.length : modules.filter((m) => m.category === cat.id).length
                if (cat.id !== "ALL" && count === 0) return null
                const active = activeCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors pointer-coarse:h-10",
                      active ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {cat.label}
                    <span className={cn("tabular-nums", active ? "text-brand/80" : "text-faint")}>{count}</span>
                  </button>
                )
              })}
            </div>
            <DataTableSearch value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search modules" className="lg:w-64" />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Puzzle} title="No modules match" description="Try another category or search term." />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((mod) => (
                <li key={mod.moduleId}>
                  <Card className="relative h-full gap-0 p-0 transition-colors hover:ring-input">
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-start gap-3">
                        <ModuleIcon name={mod.icon} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold">
                            <button type="button" onClick={() => setDetailModule(mod)} className="text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50">
                              {mod.name}
                            </button>
                          </h3>
                          <p className="mt-0.5 text-[13px] text-muted-foreground">{titleCase(mod.category)}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {mod.isNew && <Pill tone="info">New</Pill>}
                          {mod.isBeta && <Pill tone="warning">Beta</Pill>}
                        </div>
                      </div>

                      <p className="line-clamp-2 text-[13px] text-muted-foreground">{mod.shortDescription || mod.description}</p>

                      <p className="mt-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                        {mod.ratingCount > 0 && (
                          <span className="flex items-center gap-1"><Star className="size-3 fill-current" aria-hidden />{mod.rating.toFixed(1)}</span>
                        )}
                        <span>{mod.installCount} installs</span>
                        <span aria-hidden>·</span>
                        <span>{PLAN_LABEL[mod.requiredPlan] || PLAN_LABEL.FREE} plan</span>
                      </p>
                    </div>

                    <div className="relative z-10 flex items-center justify-between gap-2 border-t border-rule px-4 py-2.5">
                      {mod.isEnabled ? (
                        <>
                          <Pill tone="positive" dot>Enabled</Pill>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/admin/org/website/modules/${mod.moduleId}/config`) }}>Configure</Button>
                        </>
                      ) : (
                        <>
                          <span className="text-[13px] text-muted-foreground">Not enabled</span>
                          <Button variant="outline" size="sm" disabled={enablingId === mod.moduleId}
                            onClick={(e) => { e.stopPropagation(); handleEnable(mod.moduleId) }}>
                            {enablingId === mod.moduleId && <Loader2 className="animate-spin" />}Enable
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Enabled */}
        <TabsContent value="enabled">
          {enabledModules.length === 0 ? (
            <EmptyState icon={Puzzle} title="No modules enabled yet" description="Browse the marketplace to get started!" />
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-lg border">
              {enabledModules.map((mod) => (
                <li key={mod.moduleId} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <ModuleIcon name={mod.icon} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{mod.name}</h3>
                        <Pill tone="positive" dot>On</Pill>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-muted-foreground tabular-nums">
                        {mod.dataCount > 0 && <span>{mod.dataCount} entries</span>}
                        {mod.lastActivity && <span className="flex items-center gap-1"><Clock className="size-3" aria-hidden />Last active {new Date(mod.lastActivity).toLocaleDateString()}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button variant="outline" size="sm" className="max-sm:flex-1" onClick={() => router.push(`/admin/org/website/modules/${mod.moduleId}/config`)}>Configure</Button>
                    {mod.hasAdminPanel && (
                      <Button variant="outline" size="sm" className="max-sm:flex-1" onClick={() => router.push(`/admin/org/website/modules/${mod.moduleId}/manage`)}>Manage</Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive max-sm:flex-1" onClick={() => handleDisable(mod.moduleId)}>Disable</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Coming soon */}
        <TabsContent value="coming-soon">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMING_SOON.map((item) => (
              <li key={item.name} className="rounded-lg border border-dashed px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{item.name}</h3>
                  <span className="text-xs text-faint tabular-nums">{item.eta}</span>
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">{item.desc}</p>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      {/* Detail sheet */}
      <Sheet open={!!detailModule} onOpenChange={(open) => { if (!open) setDetailModule(null) }}>
        <SheetContent side="right" className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          {detailModule && (
            <>
              <SheetHeader className="border-b border-rule px-5 py-4 pr-12">
                <div className="flex items-center gap-2.5">
                  <ModuleIcon name={detailModule.icon} />
                  <SheetTitle>{detailModule.name}</SheetTitle>
                </div>
                <SheetDescription>{titleCase(detailModule.category)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-5 py-5">
                <p className="text-sm text-muted-foreground">{detailModule.description}</p>
                <dl className="divide-y divide-rule rounded-lg border text-[13px]">
                  <div className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">Plan</dt><dd>{detailModule.requiredPlan}</dd></div>
                  <div className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">Placements</dt><dd className="text-right">{detailModule.supportedPlacements.join(", ")}</dd></div>
                  <div className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">Admin panel</dt><dd>{detailModule.hasAdminPanel ? "Yes" : "No (config only)"}</dd></div>
                  <div className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted-foreground">Installs</dt><dd className="tabular-nums">{detailModule.installCount}</dd></div>
                </dl>
                {detailModule.setupGuide && (
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-semibold">Setup guide</h4>
                    <div className="text-[13px] whitespace-pre-wrap text-muted-foreground">{detailModule.setupGuide}</div>
                  </div>
                )}
              </div>
              <div className="mt-auto flex gap-2 border-t border-rule px-5 py-4">
                {detailModule.isEnabled ? (
                  <>
                    <Button variant="destructive" onClick={() => { handleDisable(detailModule.moduleId); setDetailModule(null) }}>Disable</Button>
                    <Button className="flex-1" onClick={() => { setDetailModule(null); router.push(`/admin/org/website/modules/${detailModule.moduleId}/config`) }}>Configure</Button>
                  </>
                ) : (
                  <Button className="flex-1" onClick={() => { handleEnable(detailModule.moduleId); setDetailModule(null) }}
                    disabled={enablingId === detailModule.moduleId}>
                    {enablingId === detailModule.moduleId && <Loader2 className="animate-spin" />}Enable module
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

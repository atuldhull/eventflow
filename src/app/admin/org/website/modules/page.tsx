"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Loader2, Zap, FileText, MessageCircle, Gamepad2, ShoppingBag, Calendar, Settings, Star, Check, X, ExternalLink, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useRBAC } from "@/hooks/useRBAC"

interface Module {
  id: string; moduleId: string; name: string; description: string; shortDescription: string | null
  icon: string; category: string; configSchema: any; defaultConfig: any
  hasAdminPanel: boolean; requiredPlan: string; supportedPlacements: string[]
  isPremium: boolean; isBeta: boolean; isNew: boolean; sortOrder: number
  installCount: number; rating: number; ratingCount: number; setupGuide: string | null
  isEnabled: boolean; currentConfig: any; dataCount: number; lastActivity: string | null
}

const CATEGORIES = [
  { id: "ALL", label: "All", icon: null },
  { id: "ENGAGEMENT", label: "Engagement", icon: Zap },
  { id: "CONTENT", label: "Content", icon: FileText },
  { id: "SOCIAL", label: "Social", icon: MessageCircle },
  { id: "GAMIFICATION", label: "Gamification", icon: Gamepad2 },
  { id: "COMMERCE", label: "Commerce", icon: ShoppingBag },
  { id: "UTILITY", label: "Utility", icon: Settings },
]

const CATEGORY_COLORS: Record<string, string> = {
  ENGAGEMENT: "bg-purple-100 text-purple-700", CONTENT: "bg-blue-100 text-blue-700",
  SOCIAL: "bg-green-100 text-green-700", GAMIFICATION: "bg-orange-100 text-orange-700",
  COMMERCE: "bg-pink-100 text-pink-700", UTILITY: "bg-gray-100 text-gray-700",
  SCHEDULING: "bg-teal-100 text-teal-700",
}

const PLAN_BADGES: Record<string, { label: string; className: string }> = {
  FREE: { label: "Free", className: "text-green-600 bg-green-50" },
  STARTER: { label: "Starter", className: "text-blue-600 bg-blue-50" },
  PRO: { label: "Pro", className: "text-purple-600 bg-purple-50" },
}

const COMING_SOON = [
  { name: "Live Streaming", desc: "Stream events directly on your website", eta: "Q3 2026" },
  { name: "AI Chatbot", desc: "Answer visitor questions with AI", eta: "Q4 2026" },
  { name: "Donation Widget", desc: "Accept donations for your cause", eta: "Q3 2026" },
  { name: "Scavenger Hunt", desc: "Gamified treasure hunt for events", eta: "Q4 2026" },
  { name: "Live Q&A", desc: "Real-time question and answer sessions", eta: "Q3 2026" },
]

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

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feature Modules</h1>
        <p className="text-muted-foreground text-sm mt-1">Add interactive features to your website</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([["marketplace", "Marketplace"], ["enabled", `Enabled (${enabledModules.length})`], ["coming-soon", "Coming Soon"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Marketplace Tab */}
      {activeTab === "marketplace" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => {
                const count = cat.id === "ALL" ? modules.length : modules.filter((m) => m.category === cat.id).length
                if (cat.id !== "ALL" && count === 0) return null
                return (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {cat.label} ({count})
                  </button>
                )
              })}
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search modules..." className="pl-8 h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((mod) => {
                const planBadge = PLAN_BADGES[mod.requiredPlan] || PLAN_BADGES.FREE
                const catColor = CATEGORY_COLORS[mod.category] || CATEGORY_COLORS.UTILITY
                return (
                  <motion.div key={mod.moduleId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} layout>
                    <Card className="p-4 space-y-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailModule(mod)}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${catColor}`}>
                            {mod.icon === "HelpCircle" ? "?" : mod.icon === "BarChart2" ? "📊" : mod.icon === "Timer" ? "⏱" : mod.icon === "Trophy" ? "🏆" : mod.icon === "Images" ? "📸" : mod.icon === "FileText" ? "📝" : mod.icon === "Award" ? "🏅" : mod.icon === "Users" ? "👥" : mod.icon === "CalendarDays" ? "📅" : mod.icon === "HandHeart" ? "🤝" : mod.icon === "ShoppingBag" ? "🛍" : mod.icon === "CloudSun" ? "⛅" : "📦"}
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm flex items-center gap-1.5">
                              {mod.name}
                              {mod.isNew && <Badge className="text-[9px] bg-blue-500 text-white border-0">NEW</Badge>}
                              {mod.isBeta && <Badge className="text-[9px] bg-amber-500 text-white border-0">BETA</Badge>}
                            </h3>
                            <Badge className={`text-[9px] ${catColor}`}>{mod.category}</Badge>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2">{mod.shortDescription || mod.description}</p>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        {mod.ratingCount > 0 && <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{mod.rating.toFixed(1)}</span>}
                        <span>{mod.installCount} installs</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t">
                        <Badge variant="outline" className={`text-[10px] ${planBadge.className}`}>{planBadge.label}</Badge>
                        {mod.isEnabled ? (
                          <div className="flex gap-1.5">
                            <Badge className="text-[10px] bg-green-500 text-white border-0 gap-0.5"><Check className="h-2.5 w-2.5" />Enabled</Badge>
                            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={(e) => { e.stopPropagation(); router.push(`/admin/org/website/modules/${mod.moduleId}/config`) }}>Configure</Button>
                          </div>
                        ) : (
                          <Button size="sm" className="h-7 text-xs" disabled={enablingId === mod.moduleId}
                            onClick={(e) => { e.stopPropagation(); handleEnable(mod.moduleId) }}>
                            {enablingId === mod.moduleId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Enable
                          </Button>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Enabled Tab */}
      {activeTab === "enabled" && (
        <div className="space-y-3">
          {enabledModules.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No modules enabled yet. Browse the marketplace to get started!</p>
          ) : enabledModules.map((mod) => (
            <Card key={mod.moduleId} className="p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${CATEGORY_COLORS[mod.category] || ""}`}>
                {mod.icon === "HelpCircle" ? "?" : mod.icon === "Trophy" ? "🏆" : mod.icon === "Images" ? "📸" : mod.icon === "FileText" ? "📝" : "📦"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{mod.name}</h3>
                  <Badge className="text-[9px] bg-green-500 text-white border-0">ON</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {mod.dataCount > 0 && <span>{mod.dataCount} entries</span>}
                  {mod.lastActivity && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />Last active {new Date(mod.lastActivity).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.push(`/admin/org/website/modules/${mod.moduleId}/config`)}>Configure</Button>
                {mod.hasAdminPanel && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.push(`/admin/org/website/modules/${mod.moduleId}/manage`)}>Manage</Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleDisable(mod.moduleId)}>Disable</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Coming Soon Tab */}
      {activeTab === "coming-soon" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMING_SOON.map((item) => (
            <Card key={item.name} className="p-4 opacity-60 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{item.name}</h3>
                <Badge variant="secondary" className="text-[9px]">Coming {item.eta}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {detailModule && (
          <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDetailModule(null)}>
            <div className="absolute inset-0 bg-black/50" />
            <motion.div className="relative w-full max-w-md bg-background shadow-xl overflow-y-auto"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{detailModule.name}</h2>
                    <Badge className={`text-[10px] ${CATEGORY_COLORS[detailModule.category] || ""}`}>{detailModule.category}</Badge>
                  </div>
                  <button onClick={() => setDetailModule(null)}><X className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-muted-foreground">{detailModule.description}</p>
                <div className="space-y-1 text-xs">
                  <p><strong>Plan:</strong> {detailModule.requiredPlan}</p>
                  <p><strong>Placements:</strong> {detailModule.supportedPlacements.join(", ")}</p>
                  <p><strong>Admin Panel:</strong> {detailModule.hasAdminPanel ? "Yes" : "No (config only)"}</p>
                  <p><strong>Installs:</strong> {detailModule.installCount}</p>
                </div>
                {detailModule.setupGuide && (
                  <div className="prose prose-sm max-w-none border-t pt-4">
                    <h4 className="text-sm font-semibold">Setup Guide</h4>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap">{detailModule.setupGuide}</div>
                  </div>
                )}
                <div className="pt-4 flex gap-2">
                  {detailModule.isEnabled ? (
                    <>
                      <Button className="flex-1" onClick={() => { setDetailModule(null); router.push(`/admin/org/website/modules/${detailModule.moduleId}/config`) }}>Configure</Button>
                      <Button variant="destructive" size="sm" onClick={() => { handleDisable(detailModule.moduleId); setDetailModule(null) }}>Disable</Button>
                    </>
                  ) : (
                    <Button className="flex-1" onClick={() => { handleEnable(detailModule.moduleId); setDetailModule(null) }}
                      disabled={enablingId === detailModule.moduleId}>
                      {enablingId === detailModule.moduleId ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Enable Module
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Layout, FileText, Puzzle, ImageIcon, Paintbrush, Search, CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRBAC } from "@/hooks/useRBAC"

interface ContentStats {
  sections: { homepage: number; total: number }
  pages: { total: number }
  modules: { enabled: number; total: number }
  media: { total: number; totalSizeMB: number }
  moduleContent: Record<string, number>
  completeness: { score: number; items: { key: string; label: string; done: boolean; action?: string }[] }
}

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

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  if (!stats) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-muted-foreground">No website configured yet</p>
      <Link href="/admin/org/website"><Button>Set Up Website</Button></Link>
    </div>
  )

  const completedCount = stats.completeness.items.filter((i) => i.done).length
  const totalChecks = stats.completeness.items.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Everything on your website at a glance</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Layout className="h-5 w-5" />, label: "Sections", value: String(stats.sections.homepage), sub: `${stats.sections.total} total`, href: "/admin/org/website/editor" },
          { icon: <FileText className="h-5 w-5" />, label: "Pages", value: String(stats.pages.total), sub: "including homepage", href: "/admin/org/website/editor" },
          { icon: <Puzzle className="h-5 w-5" />, label: "Modules", value: `${stats.modules.enabled}/${stats.modules.total}`, sub: "enabled", href: "/admin/org/website/modules" },
          { icon: <ImageIcon className="h-5 w-5" />, label: "Media", value: String(stats.media.total), sub: `${stats.media.totalSizeMB} MB`, href: "/admin/org/website/media" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={stat.href}>
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="text-primary mb-2">{stat.icon}</div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label} &bull; {stat.sub}</p>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Completeness */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Website Completeness</h2>
            <p className="text-xs text-muted-foreground">{completedCount}/{totalChecks} items complete</p>
          </div>
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted opacity-20" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                className={stats.completeness.score >= 80 ? "text-green-500" : stats.completeness.score >= 50 ? "text-amber-500" : "text-red-500"}
                strokeDasharray={`${2 * Math.PI * 42}`} strokeDashoffset={`${2 * Math.PI * 42 * (1 - stats.completeness.score / 100)}`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{stats.completeness.score}%</span>
          </div>
        </div>

        <div className="space-y-2">
          {stats.completeness.items.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={`text-sm flex-1 ${item.done ? "text-muted-foreground line-through" : ""}`}>{item.label}</span>
              {!item.done && item.action && (
                <Link href={item.action}><Button variant="ghost" size="sm" className="h-6 text-[10px]">Fix</Button></Link>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: <Paintbrush className="h-5 w-5" />, label: "Edit Homepage", href: "/admin/org/website/editor" },
            { icon: <ImageIcon className="h-5 w-5" />, label: "Upload Images", href: "/admin/org/website/media" },
            { icon: <Search className="h-5 w-5" />, label: "Update SEO", href: "/admin/org/website/editor" },
            { icon: <Puzzle className="h-5 w-5" />, label: "Browse Modules", href: "/admin/org/website/modules" },
            { icon: <FileText className="h-5 w-5" />, label: "Add Page", href: "/admin/org/website/editor" },
            { icon: <Layout className="h-5 w-5" />, label: "Change Template", href: "/admin/org/website/templates" },
          ].map((action) => (
            <Link key={action.label} href={action.href}>
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-3">
                <div className="text-primary">{action.icon}</div>
                <span className="text-sm font-medium">{action.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Module Content */}
      {Object.keys(stats.moduleContent).length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Module Content</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(stats.moduleContent).map(([moduleId, count]) => (
              <Link key={moduleId} href={`/admin/org/website/modules/${moduleId}/manage`}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <p className="text-sm font-medium">{moduleId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</p>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                  <p className="text-xs text-muted-foreground">entries</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

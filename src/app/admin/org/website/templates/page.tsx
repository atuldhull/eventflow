"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Loader2, SlidersHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TemplateCard } from "@/components/website/TemplateCard"
import { useRBAC } from "@/hooks/useRBAC"

interface Template {
  id: string
  name: string
  slug: string
  description: string
  longDescription: string | null
  category: string
  thumbnail: string | null
  tags: string[]
  isPremium: boolean
  isFeatured: boolean
  requiredPlan: string
  installCount: number
  rating: number
  ratingCount: number
  supportedFeatures: string[]
  defaultSections: any
  defaultStyles: any
  isCurrentTemplate: boolean
  canApply: boolean
}

const CATEGORIES = [
  { id: "ALL", label: "All" },
  { id: "SPORTS", label: "Sports & Fitness" },
  { id: "TECH", label: "Tech & Developer" },
  { id: "CORPORATE", label: "Corporate" },
  { id: "COMMUNITY", label: "Community" },
  { id: "EDUCATION", label: "Education" },
  { id: "CREATIVE", label: "Creative" },
  { id: "MINIMAL", label: "Minimal" },
]

const SORT_OPTIONS = [
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Highest Rated" },
  { value: "name", label: "Name (A-Z)" },
]

export default function TemplateMarketplacePage() {
  const router = useRouter()
  const { currentOrganizationId } = useRBAC()
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("ALL")
  const [sortBy, setSortBy] = useState("popular")
  const [freeOnly, setFreeOnly] = useState(false)
  const [featuredOnly, setFeaturedOnly] = useState(false)

  useEffect(() => {
    if (!currentOrganizationId) return
    async function fetch_() {
      try {
        const res = await fetch(`/api/admin/org/${currentOrganizationId}/website/templates`)
        const json = await res.json()
        if (json.success) setTemplates(json.data)
      } catch {} finally { setIsLoading(false) }
    }
    fetch_()
  }, [currentOrganizationId])

  const currentTemplate = templates.find((t) => t.isCurrentTemplate)

  const filtered = useMemo(() => {
    let result = [...templates]

    // Category
    if (activeCategory !== "ALL") result = result.filter((t) => t.category === activeCategory)

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q)))
    }

    // Toggles
    if (freeOnly) result = result.filter((t) => t.requiredPlan === "FREE")
    if (featuredOnly) result = result.filter((t) => t.isFeatured)

    // Sort
    if (sortBy === "popular") result.sort((a, b) => b.installCount - a.installCount)
    else if (sortBy === "rating") result.sort((a, b) => b.rating - a.rating)
    else if (sortBy === "name") result.sort((a, b) => a.name.localeCompare(b.name))

    return result
  }, [templates, activeCategory, searchQuery, sortBy, freeOnly, featuredOnly])

  const categoriesWithCounts = useMemo(() =>
    CATEGORIES.map((cat) => ({
      ...cat,
      count: cat.id === "ALL" ? templates.length : templates.filter((t) => t.category === cat.id).length,
    })).filter((cat) => cat.id === "ALL" || cat.count > 0)
  , [templates])

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Template Marketplace</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose a design for your website</p>
        {currentTemplate && (
          <Badge variant="outline" className="mt-2 text-xs">Current: {currentTemplate.name} &mdash; Changing template will reset your section layout but keep your content</Badge>
        )}
      </div>

      {/* Filter Bar */}
      <div className="space-y-3">
        {/* Category pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {categoriesWithCounts.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.label} {cat.count > 0 && `(${cat.count})`}
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search templates..." className="pl-8 h-9 text-sm" />
          </div>
          <button
            onClick={() => setFreeOnly(!freeOnly)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${freeOnly ? "bg-green-100 text-green-700 dark:bg-green-900/30" : "bg-muted text-muted-foreground"}`}
          >
            Free Only
          </button>
          <button
            onClick={() => setFeaturedOnly(!featuredOnly)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${featuredOnly ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30" : "bg-muted text-muted-foreground"}`}
          >
            Featured
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-2 text-xs"
          >
            {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {/* Template Grid */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-sm text-muted-foreground py-12">
            No templates found. Try different filters.
          </motion.p>
        ) : (
          <motion.div key="grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {filtered.map((template, idx) => (
              <TemplateCard
                key={template.id}
                template={template}
                isCurrentTemplate={template.isCurrentTemplate}
                onPreview={() => router.push(`/admin/org/website/templates/${template.slug}`)}
                onApply={() =>
                  router.push(
                    template.canApply
                      ? `/admin/org/website/templates/${template.slug}`
                      : "/admin/org/billing"
                  )
                }
                canApply={template.canApply}
                requiredPlanName={template.requiredPlan}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

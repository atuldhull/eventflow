"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { LayoutTemplate } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { DataTableSearch } from "@/components/tables/DataTableToolbar"
import { TemplateCard } from "@/components/website/TemplateCard"
import { nativeSelectClass } from "@/components/website/media/UploadZone"
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
/* eslint-enable @typescript-eslint/no-explicit-any */

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
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Highest rated" },
  { value: "name", label: "Name (A–Z)" },
]

const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors pointer-coarse:h-10",
    active ? "border-brand/40 bg-brand/10 text-brand" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
  )

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

  const header = (
    <PageHeader
      title="Templates"
      description="Choose a design for your website"
      breadcrumbs={[{ label: "Website", href: "/admin/org/website" }, { label: "Templates" }]}
    />
  )

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        {header}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      {currentTemplate && (
        <p className="rounded-lg border bg-raised px-4 py-3 text-[13px] text-muted-foreground">
          You&apos;re using <span className="font-medium text-foreground">{currentTemplate.name}</span>. Changing template will reset your section layout but keep your content.
        </p>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
          {categoriesWithCounts.map((cat) => (
            <button key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)} aria-pressed={activeCategory === cat.id} className={chipClass(activeCategory === cat.id)}>
              {cat.label}
              {cat.count > 0 && <span className={cn("tabular-nums", activeCategory === cat.id ? "text-brand/80" : "text-faint")}>{cat.count}</span>}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <DataTableSearch value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search templates" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setFreeOnly(!freeOnly)} aria-pressed={freeOnly} className={chipClass(freeOnly)}>Free only</button>
            <button type="button" onClick={() => setFeaturedOnly(!featuredOnly)} aria-pressed={featuredOnly} className={chipClass(featuredOnly)}>Featured</button>
            <select aria-label="Sort templates" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={cn(nativeSelectClass, "h-8 flex-1 text-[13px] sm:ml-auto sm:flex-none")}>
              {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No templates found" description="Try different filters." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <li key={template.id}>
              <TemplateCard
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

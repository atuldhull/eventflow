"use client"

import { motion } from "framer-motion"
import { Eye, Lock, Star, Check, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Template {
  id: string
  name: string
  slug: string
  description: string
  category: string
  thumbnail: string | null
  tags: string[]
  isPremium: boolean
  isFeatured: boolean
  requiredPlan: string
  installCount: number
  rating: number
  ratingCount: number
  defaultStyles?: any
}

interface TemplateCardProps {
  template: Template
  isCurrentTemplate?: boolean
  onPreview: () => void
  onApply: () => void
  canApply: boolean
  requiredPlanName?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  SPORTS: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  TECH: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  CORPORATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  MINIMAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  CREATIVE: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  EDUCATION: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  COMMUNITY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PREMIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

const PLAN_BADGES: Record<string, { label: string; className: string }> = {
  FREE: { label: "Free", className: "text-green-600 bg-green-50 dark:bg-green-900/20" },
  STARTER: { label: "Starter Plan", className: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
  PRO: { label: "Pro Plan", className: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
}

export function TemplateCard({ template, isCurrentTemplate, onPreview, onApply, canApply, requiredPlanName }: TemplateCardProps) {
  const planBadge = PLAN_BADGES[template.requiredPlan] || PLAN_BADGES.FREE
  const catColor = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.MINIMAL

  // Generate gradient preview from template styles
  const previewBg = template.defaultStyles
    ? `linear-gradient(135deg, ${template.defaultStyles.primaryColor}22, ${template.defaultStyles.secondaryColor}33, ${template.defaultStyles.backgroundColor})`
    : "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)"

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-200">
        {/* Thumbnail */}
        <div className="relative aspect-[16/9] overflow-hidden" style={{ background: previewBg }}>
          {template.thumbnail && (
            <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" loading="lazy" />
          )}
          {!template.thumbnail && (
            <div className="w-full h-full flex items-center justify-center">
              <Palette className="h-10 w-10" style={{ color: template.defaultStyles?.primaryColor || "#6366f1", opacity: 0.4 }} />
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Button variant="secondary" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onPreview() }}>
              <Eye className="h-3.5 w-3.5" />Preview
            </Button>
          </div>

          {/* Badges */}
          {template.isPremium && (
            <Badge className="absolute top-2 left-2 text-[10px] bg-amber-500 text-white border-0">PRO</Badge>
          )}
          {template.isFeatured && (
            <div className="absolute top-2 right-2">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </div>
          )}
          {isCurrentTemplate && (
            <Badge className="absolute top-2 left-2 text-[10px] bg-green-500 text-white border-0 gap-0.5">
              <Check className="h-3 w-3" />Current
            </Badge>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{template.name}</h3>
            <Badge className={`text-[10px] shrink-0 ${catColor}`}>{template.category}</Badge>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>

          {/* Tags */}
          {template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{template.installCount} installs</span>
            {template.ratingCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {template.rating.toFixed(1)} ({template.ratingCount})
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex items-center justify-between gap-2">
          <Badge variant="outline" className={`text-[10px] ${planBadge.className}`}>{planBadge.label}</Badge>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onPreview}>Preview</Button>
            {canApply ? (
              <Button size="sm" className="h-7 text-xs" onClick={onApply} disabled={isCurrentTemplate}>
                {isCurrentTemplate ? "Current" : "Use Template"}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={onApply}>
                <Lock className="h-3 w-3" />Upgrade
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export default TemplateCard

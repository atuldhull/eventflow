"use client"

import { Lock, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Pill } from "@/components/ui/pill"

/* eslint-disable @typescript-eslint/no-explicit-any -- template styles are loosely typed by the API */
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
/* eslint-enable @typescript-eslint/no-explicit-any */

interface TemplateCardProps {
  template: Template
  isCurrentTemplate?: boolean
  onPreview: () => void
  onApply: () => void
  canApply: boolean
  requiredPlanName?: string
}

const PLAN_LABEL: Record<string, string> = { FREE: "Free", STARTER: "Starter plan", PRO: "Pro plan" }
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/**
 * A template in the marketplace. Without a thumbnail, the preview is drawn
 * from the template's own colours (it is the tenant's palette, not ours):
 * a flat page with a nav bar, a headline block and a button.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TemplateCard({ template, isCurrentTemplate, onPreview, onApply, canApply, requiredPlanName }: TemplateCardProps) {
  const s = template.defaultStyles || {}
  const bg = s.backgroundColor || "var(--raised)"
  const primary = s.primaryColor || "var(--muted-foreground)"
  const secondary = s.secondaryColor || "var(--foreground)"

  return (
    <Card className="group h-full gap-0 p-0 transition-colors hover:ring-input">
      {/* Thumbnail */}
      <button type="button" onClick={onPreview} className="relative block aspect-[16/9] w-full overflow-hidden border-b text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Preview ${template.name}`}>
        {template.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- template thumbnails at arbitrary URLs
          <img src={template.thumbnail} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full flex-col" style={{ background: bg }} data-no-dim aria-hidden>
            <div className="flex items-center justify-between px-[7%] py-[4%]">
              <span className="h-2 w-12 rounded-full" style={{ background: secondary, opacity: 0.8 }} />
              <span className="flex gap-1.5">
                <span className="h-1.5 w-6 rounded-full" style={{ background: secondary, opacity: 0.35 }} />
                <span className="h-1.5 w-6 rounded-full" style={{ background: secondary, opacity: 0.35 }} />
                <span className="h-1.5 w-6 rounded-full" style={{ background: secondary, opacity: 0.35 }} />
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-2 px-[7%]">
              <span className="h-3 w-3/5 rounded-sm" style={{ background: secondary, opacity: 0.85 }} />
              <span className="h-2 w-2/5 rounded-sm" style={{ background: secondary, opacity: 0.35 }} />
              <span className="mt-1.5 h-4 w-16 rounded-[3px]" style={{ background: primary }} />
            </div>
          </div>
        )}
        <span className="absolute top-2 left-2 flex gap-1">
          {isCurrentTemplate && <Pill tone="positive" dot>Current</Pill>}
          {!isCurrentTemplate && template.isPremium && <Pill>Pro</Pill>}
        </span>
        {template.isFeatured && (
          <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-[4px] bg-background/90 text-foreground">
            <Star className="size-3.5 fill-current" aria-label="Featured" />
          </span>
        )}
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 px-4 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold">{template.name}</h3>
          <span className="shrink-0 text-xs text-muted-foreground">{titleCase(template.category)}</span>
        </div>
        <p className="line-clamp-2 text-[13px] text-muted-foreground">{template.description}</p>
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
            ))}
          </div>
        )}
        <p className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground tabular-nums">
          <span>{template.installCount} installs</span>
          {template.ratingCount > 0 && (
            <span className="flex items-center gap-1">
              <Star className="size-3 fill-current" aria-hidden />
              {template.rating.toFixed(1)} ({template.ratingCount})
            </span>
          )}
          <span aria-hidden>·</span>
          <span>{PLAN_LABEL[template.requiredPlan] || PLAN_LABEL.FREE}</span>
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-1.5 border-t border-rule px-4 py-2.5">
        <Button variant="ghost" size="sm" onClick={onPreview}>Preview</Button>
        {canApply ? (
          <Button variant="outline" size="sm" onClick={onApply} disabled={isCurrentTemplate}>
            {isCurrentTemplate ? "Current" : "Use template"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onApply}>
            <Lock />Upgrade
          </Button>
        )}
      </div>
    </Card>
  )
}

export default TemplateCard

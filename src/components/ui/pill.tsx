import { cn } from "@/lib/utils"

export type Tone = "positive" | "negative" | "warning" | "info" | "neutral" | "brand"

const toneClass: Record<Tone, string> = {
  positive: "bg-pill-positive text-pill-positive-foreground",
  negative: "bg-pill-negative text-pill-negative-foreground",
  warning: "bg-pill-warning text-pill-warning-foreground",
  info: "bg-pill-info text-pill-info-foreground",
  neutral: "bg-pill-neutral text-pill-neutral-foreground",
  brand: "bg-brand/12 text-brand",
}

const dotClass: Record<Tone, string> = {
  positive: "bg-positive",
  negative: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-muted-foreground/60",
  brand: "bg-brand",
}

/**
 * A status pill: a pale tint with dark ink of the same hue. Used inside rows
 * and beside values only, never above a heading.
 */
export function Pill({
  tone = "neutral",
  dot = false,
  live = false,
  className,
  children,
}: {
  tone?: Tone
  dot?: boolean
  /** a softly pulsing dot for things happening right now */
  live?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <span data-slot="pill" className={cn("pill", toneClass[tone], className)}>
      {(dot || live) && (
        <span aria-hidden className={cn("size-1.5 rounded-full", dotClass[tone], live && "animate-pulse")} />
      )}
      {children}
    </span>
  )
}

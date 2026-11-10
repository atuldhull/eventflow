import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  children?: React.ReactNode
  className?: string
  /** "block" sits inside a card or table area; "page" fills a first-run screen */
  variant?: "block" | "page"
}

/**
 * An empty area keeps its frame and says what to do next. The action, when
 * there is one, goes where the data will appear.
 */
export function EmptyState({ title, description, icon: Icon, children, className, variant = "block" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border text-center",
        variant === "page" ? "px-6 py-16" : "px-5 py-10",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex items-center justify-center text-faint">
          <Icon className="size-6" strokeWidth={1.5} aria-hidden />
        </span>
      )}
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-[46ch] text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

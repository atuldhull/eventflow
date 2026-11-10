import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * The row above a table: search on the left, filters after it, the table's
 * own actions pushed right. Stacks to full width on phones.
 */
export function DataTableToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {children}
    </div>
  )
}

/**
 * A search box for a table: a 36px field with a grey glyph. Takes every
 * input prop (value, onChange, onKeyDown…), so it drops in for a plain Input.
 */
export function DataTableSearch({
  className,
  "aria-label": ariaLabel,
  placeholder = "Search",
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <Input type="search" placeholder={placeholder} aria-label={ariaLabel ?? placeholder} className="pl-8" {...props} />
    </div>
  )
}

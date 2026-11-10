import Link from "next/link"
import { ChevronRight, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { cn } from "@/lib/utils"

/*
 * Presentation helpers shared by the enterprise-admin and platform-admin
 * screens. Nothing here fetches or decides anything; it only lays data out.
 */

export const inr = (n: number | null | undefined) => `₹${Number(n ?? 0).toLocaleString("en-IN")}`
export const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-IN")

export function fmtDate(value: string | null | undefined, withYear = false) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) })
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

/** A settings-style block: the heading and a grey line on the left, the controls on the right. */
export function Section({
  title,
  description,
  children,
  className,
  id,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section
      aria-labelledby={id ? `${id}-heading` : undefined}
      className={cn("grid gap-4 border-t border-rule pt-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10", className)}
    >
      <div>
        <h2 id={id ? `${id}-heading` : undefined} className="font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

/** A heading row above a list or panel, with an optional link on the right. */
export function BlockHeading({ id, title, href, linkLabel }: { id?: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
      <h2 id={id} className="font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
      {href && (
        <Link href={href} className="rounded-sm text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          {linkLabel ?? "View all"}
        </Link>
      )}
    </div>
  )
}

/** A search box with a leading glyph; the visible placeholder doubles as its accessible name. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <Input
        type="search"
        aria-label={placeholder.replace(/…|\.\.\.$/, "")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8"
      />
    </div>
  )
}

/** The empty state that sits inside a table body (the table already draws the frame). */
export function TableEmpty({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <EmptyState className="border-0 px-2 py-6" title={title} description={description}>
      {children}
    </EmptyState>
  )
}

/** A neutral letter avatar for people and tenants. */
export function Initial({ name, className }: { name?: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {name?.trim()?.[0]?.toUpperCase() || "?"}
    </span>
  )
}

/** Name over a grey second line; used as the first cell of most rows. */
export function PrimaryCell({ title, meta, children }: { title: React.ReactNode; meta?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <p className="truncate font-medium text-foreground">{title}</p>
        {children}
      </div>
      {meta && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{meta}</p>}
    </div>
  )
}

/** A plain navigation row: label, a grey line, and a chevron. */
export function LinkRow({ href, label, description }: { href: string; label: string; description?: string }) {
  return (
    <li>
      <Link href={href} className="group flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="truncate text-[13px] text-muted-foreground">{description}</p>}
        </div>
        <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  )
}

/** Placeholder rows while a list loads. */
export function RowsSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <ul className={cn("divide-y divide-rule", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-3.5", i % 2 ? "w-2/5" : "w-3/5")} />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-16 rounded-sm" />
        </li>
      ))}
    </ul>
  )
}

/** Registrations against capacity: the count, and a hairline bar when there is a cap. */
export function CapacityCell({ count, capacity }: { count: number; capacity: number | null }) {
  const pct = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : 0
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="tabular-nums">
        {num(count)}
        {capacity ? <span className="text-muted-foreground"> / {num(capacity)}</span> : null}
      </span>
      {capacity ? (
        <span className="block h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </div>
  )
}

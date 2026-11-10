import { cn } from "@/lib/utils"

/**
 * One section of the event page's main column: a hairline above, a 16px
 * heading, then the content. Keeps every section on the same rhythm.
 */
export function EventSection({
  id,
  title,
  meta,
  className,
  children,
}: {
  id: string
  title: string
  /** quiet text after the heading, e.g. a count */
  meta?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className={cn("border-t border-rule pt-8", className)}>
      <h2 id={`${id}-heading`} className="text-base font-semibold tracking-[-0.01em]">
        {title}
        {meta != null && <span className="ml-2 font-normal text-muted-foreground tabular-nums">{meta}</span>}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

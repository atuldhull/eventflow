import { cn } from "@/lib/utils"

/**
 * One section of the event page's main column: a hairline above, a short lemon rule and a
 * display-type heading, then the content. Every section shares the heading; each one
 * brings its own layout underneath.
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
    <section aria-labelledby={`${id}-heading`} className={cn("scroll-mt-24 border-t border-rule pt-10", className)}>
      <EventSectionHeading id={`${id}-heading`} meta={meta}>
        {title}
      </EventSectionHeading>
      <div className="mt-6">{children}</div>
    </section>
  )
}

/** The section heading on its own, for sections that build their own wrapper. */
export function EventSectionHeading({ id, meta, children }: { id: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display flex flex-wrap items-center gap-x-3 gap-y-1 text-[26px] leading-[1.05] font-extrabold tracking-[-0.035em] sm:text-[32px]">
      <span aria-hidden className="h-[3px] w-6 shrink-0 rounded-full bg-lemon" />
      <span>{children}</span>
      {meta != null && (
        <span className="rounded-full bg-lavender/15 px-2.5 py-0.5 font-sans text-[13px] font-semibold tracking-normal text-brand tabular-nums">
          {meta}
        </span>
      )}
    </h2>
  )
}

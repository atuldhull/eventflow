import { cn } from "@/lib/utils"

/** The public site's column: the same 1240px measure and gutters as the navbar and footer. */
export const containerClass = "mx-auto w-full max-w-[1240px] px-5 sm:px-8"

export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(containerClass, className)} {...props} />
}

/**
 * A public page's title block: a 32px title, a 16px grey line about the page,
 * an optional 13px meta line, and room for actions. A hairline closes it.
 */
export function PageIntro({
  title,
  description,
  meta,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  meta?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("border-b border-rule", className)}>
      <Container className="py-12 sm:py-16">
        <h1 className="max-w-[26ch] text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[32px]">{title}</h1>
        {description && <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-muted-foreground">{description}</p>}
        {meta && <p className="mt-3 text-[13px] text-muted-foreground">{meta}</p>}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </header>
  )
}

/** A section heading on a public page: 22–28px title and an optional grey line. */
export function SectionHeader({
  title,
  description,
  id,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  id?: string
  className?: string
}) {
  return (
    <div className={className}>
      <h2 id={id} className="text-[22px] leading-tight font-semibold tracking-[-0.015em] sm:text-[28px]">{title}</h2>
      {description && <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  )
}
